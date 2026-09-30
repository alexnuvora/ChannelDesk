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
    buyerId:buyer.uid,sellerId:listing.sellerId,participantIds:[buyer.uid,listing.sellerId],amount,status:OFFER_STATUS.PENDING,awaitingUserId:listing.sellerId,counteredBy:null,counterCount:0,
    parentOfferId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return ref.id;
}

export async function respondToOffer({offerId,userId,action,counterAmountPounds}){
  const ref=doc(db,'offers',offerId);
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Offer no longer exists.');
    const offer=snap.data(); if(!offer.participantIds?.includes(userId)) throw new Error('Not authorised.');
    if(offer.status!==OFFER_STATUS.PENDING) throw new Error('This offer has already been handled.');
    const awaiting=offer.awaitingUserId||offer.sellerId;
    if(action==='accept'){
      if(userId!==awaiting) throw new Error('The other person needs to respond to this offer.');
      tx.update(ref,{status:OFFER_STATUS.ACCEPTED,acceptedAt:serverTimestamp(),acceptedBy:userId,updatedAt:serverTimestamp()});
    }else if(action==='decline'){
      if(userId!==awaiting) throw new Error('The other person needs to respond to this offer.');
      tx.update(ref,{status:OFFER_STATUS.DECLINED,declinedBy:userId,updatedAt:serverTimestamp()});
    }else if(action==='withdraw'){
      if(userId!==offer.buyerId) throw new Error('Only the buyer can withdraw.');
      tx.update(ref,{status:OFFER_STATUS.WITHDRAWN,updatedAt:serverTimestamp()});
    }else if(action==='counter'){
      if(userId!==awaiting) throw new Error('Wait for the other person to respond first.');
      const amount=money(counterAmountPounds);
      const next=userId===offer.buyerId?offer.sellerId:offer.buyerId;
      tx.update(ref,{amount,status:OFFER_STATUS.PENDING,awaitingUserId:next,counteredBy:userId,counterCount:(offer.counterCount||0)+1,updatedAt:serverTimestamp()});
    }else throw new Error('Unsupported offer action.');
  });
}

export async function createOrder({listing,buyer,offer=null}){
  if(!buyer?.uid||!listing?.sellerId) throw new Error('Sign in to buy.');
  if(buyer.uid===listing.sellerId) throw new Error('You cannot buy your own listing.');
  const amount=offer?.amount ?? money(listing.price);
  const ref=offer?.id?doc(db,'orders',`offer_${offer.id}`):doc(collection(db,'orders'));
  const existing=await getDoc(ref);if(existing.exists())return ref.id;
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

export async function submitReview({order,userId,rating,comment}){
  if(!order?.id||!userId) throw new Error('Order not found.');
  if(order.status!==ORDER_STATUS.COMPLETED) throw new Error('Reviews are available after the order is completed.');
  if(!order.participantIds?.includes(userId)) throw new Error('Not authorised.');
  const n=Number(rating); if(!Number.isInteger(n)||n<1||n>5) throw new Error('Choose a rating from 1 to 5.');
  const revieweeId=userId===order.buyerId?order.sellerId:order.buyerId;
  const ref=doc(db,'reviews',order.id+'_'+userId);
  const existing=await getDoc(ref); if(existing.exists()) throw new Error('You have already reviewed this order.');
  await setDoc(ref,{orderId:order.id,listingId:order.listingId,reviewerId:userId,revieweeId,rating:n,comment:(comment||'').trim().slice(0,1000),createdAt:serverTimestamp()});
  return ref.id;
}

// Payment, payout, shipping-label and carrier-tracking state must be written by trusted server webhooks.
// The mobile client intentionally has no function that can mark an order paid, delivered, completed or paid out.
