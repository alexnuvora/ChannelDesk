import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const ORDER_STATUS = Object.freeze({
  AWAITING_PAYMENT:'awaiting_payment', PAID:'paid', READY_TO_SHIP:'ready_to_ship',
  SHIPPED:'shipped', DELIVERED:'delivered', COMPLETED:'completed',
  PROBLEM_REPORTED:'problem_reported', CANCELLED:'cancelled', REFUNDED:'refunded'
});
export const OFFER_STATUS = Object.freeze({PENDING:'pending',ACCEPTED:'accepted',COUNTERED:'countered',DECLINED:'declined',WITHDRAWN:'withdrawn'});

const money = value => {
  const n=Number(String(value).replace(/[^0-9.]/g,''));
  if(!Number.isFinite(n)||n<=0) throw new Error('Enter a valid amount.');
  return Math.round(n*100);
};

export async function createOffer({listing,buyer,amountPounds,parentOfferId=null}){
  if(!buyer?.uid||!listing?.sellerId) throw new Error('Sign in to make an offer.');
  if(buyer.uid===listing.sellerId) throw new Error('You cannot offer on your own listing.');
  const amount=money(amountPounds);
  const ref=doc(collection(db,'offers'));
  await setDoc(ref,{listingId:listing.id,listingTitle:listing.title,listingImage:listing.img||listing.imageUrl||null,
    buyerId:buyer.uid,sellerId:listing.sellerId,participantIds:[buyer.uid,listing.sellerId],amount,status:OFFER_STATUS.PENDING,
    parentOfferId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return ref.id;
}

export async function respondToOffer({offerId,userId,action,counterAmountPounds}){
  const ref=doc(db,'offers',offerId);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Offer no longer exists.');
    const offer=snap.data(); if(!offer.participantIds?.includes(userId)) throw new Error('Not authorised.');
    if(offer.status!==OFFER_STATUS.PENDING) throw new Error('This offer has already been handled.');
    if(action==='accept'){
      if(userId!==offer.sellerId) throw new Error('Only the seller can accept.');
      tx.update(ref,{status:OFFER_STATUS.ACCEPTED,acceptedAt:serverTimestamp(),updatedAt:serverTimestamp()});
    }else if(action==='decline'){
      if(userId!==offer.sellerId) throw new Error('Only the seller can decline.');
      tx.update(ref,{status:OFFER_STATUS.DECLINED,updatedAt:serverTimestamp()});
    }else if(action==='withdraw'){
      if(userId!==offer.buyerId) throw new Error('Only the buyer can withdraw.');
      tx.update(ref,{status:OFFER_STATUS.WITHDRAWN,updatedAt:serverTimestamp()});
    }else if(action==='counter'){
      const amount=money(counterAmountPounds);
      tx.update(ref,{status:OFFER_STATUS.COUNTERED,counterAmount:amount,counteredBy:userId,updatedAt:serverTimestamp()});
    }else throw new Error('Unsupported offer action.');
  });
}

export async function createOrder({listing,buyer,offer=null}){
  if(!buyer?.uid||!listing?.sellerId) throw new Error('Sign in to buy.');
  if(buyer.uid===listing.sellerId) throw new Error('You cannot buy your own listing.');
  const amount=offer?.amount ?? money(listing.price);
  const ref=doc(collection(db,'orders'));
  await setDoc(ref,{listingId:listing.id,listingTitle:listing.title,listingImage:listing.img||listing.imageUrl||null,
    buyerId:buyer.uid,sellerId:listing.sellerId,participantIds:[buyer.uid,listing.sellerId],amount,currency:'gbp',
    offerId:offer?.id||null,status:ORDER_STATUS.AWAITING_PAYMENT,paymentStatus:'not_started',shippingStatus:'not_started',
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return ref.id;
}

export async function reportProblem({orderId,userId,reason,details}){
  const orderRef=doc(db,'orders',orderId); const reportRef=doc(collection(db,'reports'));
  await runTransaction(db,async tx=>{
    const snap=await tx.get(orderRef); if(!snap.exists()) throw new Error('Order not found.');
    const order=snap.data(); if(!order.participantIds?.includes(userId)) throw new Error('Not authorised.');
    tx.set(reportRef,{orderId,reporterId:userId,participantIds:order.participantIds,reason,details:details?.trim()||'',status:'open',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    tx.update(orderRef,{status:ORDER_STATUS.PROBLEM_REPORTED,problemReportId:reportRef.id,updatedAt:serverTimestamp()});
  });
  return reportRef.id;
}

// Payment, payout, shipping-label and carrier-tracking state must be written by trusted server webhooks.
// The mobile client intentionally has no function that can mark an order paid, delivered, completed or paid out.
