import React from 'react';
import {View,Text,StyleSheet,TouchableOpacity,Image,Modal,SafeAreaView,ScrollView,Dimensions,Platform} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
const W=Dimensions.get('window').width;
export default function ListingDetailModal({listing,user,onClose,onMessage,onOffer,onBuy}){
 if(!listing)return null;
 const own=listing.sellerId===user?.uid;
 const photos=(listing.photos?.length?listing.photos:[listing.img||listing.imageUrl]).filter(Boolean);
 const price=typeof listing.price==='string'?listing.price:'£'+listing.price;
 return <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent={false} navigationBarTranslucent={false}>
  <SafeAreaView style={s.safe}><View style={s.shell}>
   <View style={s.header}><TouchableOpacity accessibilityLabel="Close listing" style={s.iconBtn} onPress={onClose}><Ionicons name="arrow-back" size={24}/></TouchableOpacity><Text style={s.headerTitle}>Item details</Text><View style={s.headerActions}><TouchableOpacity style={s.iconBtn}><Ionicons name="share-social-outline" size={22}/></TouchableOpacity><TouchableOpacity style={s.iconBtn}><Ionicons name="heart-outline" size={23}/></TouchableOpacity></View></View>
   <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={s.gallery}>{photos.map((uri,i)=><View key={uri+i} style={s.slide}><Image source={{uri}} style={s.image} resizeMode="cover"/>{photos.length>1&&<View style={s.count}><Text style={s.countText}>{i+1} / {photos.length}</Text></View>}</View>)}</ScrollView>
    <View style={s.body}>
     <Text style={s.title}>{listing.title}</Text><Text style={s.price}>{price}</Text>
     <Text style={s.vat}>Price includes buyer protection when applicable</Text>
     <View style={s.divider}/>
     <View style={s.factRow}><Text style={s.factLabel}>Condition</Text><Text style={s.factValue}>{listing.condition||listing.meta||'Good'}</Text></View>
     <View style={s.factRow}><Text style={s.factLabel}>Category</Text><Text style={s.factValue}>{listing.category||'Marketplace'}</Text></View>
     <View style={s.divider}/>
     <Text style={s.sectionTitle}>About this item</Text><Text style={s.description}>{listing.description||'Message the seller for more information about this item.'}</Text>
     <View style={s.deliveryCard}><View style={s.deliveryIcon}><Ionicons name="cube-outline" size={22} color="#3665F3"/></View><View style={{flex:1}}><Text style={s.deliveryTitle}>Delivery available</Text><Text style={s.deliveryText}>Shipping and tracking details are confirmed during checkout.</Text></View><Ionicons name="chevron-forward" size={20} color="#707070"/></View>
     <Text style={s.sectionTitle}>Seller information</Text>
     <View style={s.seller}><View style={s.sellerAvatar}><Ionicons name="person" size={23} color="#3665F3"/></View><View style={{flex:1}}><Text style={s.sellerName}>{listing.sellerName||'WhatBuy seller'}</Text><Text style={s.location}>{listing.place||listing.location||'United Kingdom'}</Text><View style={s.rating}><Ionicons name="star" size={13} color="#111820"/><Text style={s.ratingText}>Marketplace seller</Text></View></View><Ionicons name="chevron-forward" size={20} color="#707070"/></View>
     <View style={s.protection}><Ionicons name="shield-checkmark-outline" size={24} color="#3665F3"/><View style={{flex:1}}><Text style={s.protectionTitle}>Shop with confidence</Text><Text style={s.protectionText}>Keep payment and messages in WhatBuy so your transaction history stays together.</Text></View></View>
     {own&&<View style={s.own}><Ionicons name="information-circle-outline" size={20} color="#3665F3"/><Text style={s.ownText}>This is your listing. Manage it from Profile → My listings.</Text></View>}
    </View>
   </ScrollView>
   {!own&&<View style={[s.footer,Platform.OS==='android'&&s.footerAndroid]}><TouchableOpacity style={s.message} onPress={onMessage}><Text style={s.messageText}>Message seller</Text></TouchableOpacity><TouchableOpacity style={s.offer} onPress={onOffer}><Text style={s.offerText}>Make offer</Text></TouchableOpacity><TouchableOpacity style={s.buy} onPress={onBuy}><Text style={s.buyText}>Buy it now</Text></TouchableOpacity></View>}
  </View></SafeAreaView>
 </Modal>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#fff'},shell:{flex:1,minHeight:0,paddingBottom:Platform.OS==='android'?20:0},
 header:{height:58,paddingHorizontal:8,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:'#E5E5E5',backgroundColor:'#fff'},iconBtn:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'},headerTitle:{fontSize:17,fontWeight:'700',flex:1,marginLeft:4,color:'#111820'},headerActions:{flexDirection:'row'},
 scroll:{flex:1,minHeight:0},content:{paddingBottom:30},gallery:{height:Math.min(W,430),flexGrow:0,backgroundColor:'#F5F5F5'},slide:{width:W,height:Math.min(W,430),position:'relative'},image:{width:'100%',height:'100%',backgroundColor:'#F2F2F2'},
 count:{position:'absolute',right:14,bottom:14,backgroundColor:'rgba(17,24,32,.78)',paddingHorizontal:10,paddingVertical:5,borderRadius:14},countText:{color:'#fff',fontWeight:'700',fontSize:12},
 body:{paddingHorizontal:18,paddingTop:18},title:{fontSize:18,fontWeight:'500',lineHeight:24,color:'#333'},price:{fontSize:29,fontWeight:'800',letterSpacing:-.6,color:'#111820',marginTop:8},vat:{fontSize:11.5,color:'#707070',marginTop:4},
 divider:{height:1,backgroundColor:'#E5E5E5',marginVertical:18},factRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:5},factLabel:{fontSize:14,color:'#707070'},factValue:{fontSize:14,fontWeight:'600',color:'#111820',maxWidth:'65%',textAlign:'right'},
 sectionTitle:{fontSize:18,fontWeight:'800',color:'#111820',marginBottom:9},description:{fontSize:14.5,lineHeight:22,color:'#333',marginBottom:20},
 deliveryCard:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:15,borderTopWidth:1,borderBottomWidth:1,borderColor:'#E5E5E5',marginBottom:22},deliveryIcon:{width:42,height:42,borderRadius:21,backgroundColor:'#F1F4FF',alignItems:'center',justifyContent:'center'},deliveryTitle:{fontSize:14.5,fontWeight:'700',color:'#111820'},deliveryText:{fontSize:12,color:'#707070',lineHeight:17,marginTop:2},
 seller:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:8,marginBottom:18},sellerAvatar:{width:48,height:48,borderRadius:24,backgroundColor:'#F1F4FF',alignItems:'center',justifyContent:'center'},sellerName:{fontWeight:'700',fontSize:15,color:'#111820'},location:{fontSize:12,color:'#707070',marginTop:2},rating:{flexDirection:'row',alignItems:'center',gap:4,marginTop:4},ratingText:{fontSize:11.5,color:'#555'},
 protection:{flexDirection:'row',gap:11,backgroundColor:'#F7F8FF',borderRadius:12,padding:14,marginBottom:14},protectionTitle:{fontWeight:'800',fontSize:14,color:'#111820'},protectionText:{fontSize:12,color:'#555',lineHeight:18,marginTop:3},
 own:{flexDirection:'row',gap:8,backgroundColor:'#F1F4FF',padding:13,borderRadius:12},ownText:{flex:1,color:'#2948A5',lineHeight:19,fontWeight:'600'},
 footer:{flexShrink:0,minHeight:132,paddingHorizontal:12,paddingTop:10,paddingBottom:14,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#E5E5E5',flexDirection:'row',flexWrap:'wrap',gap:8},
 footerAndroid:{paddingBottom:10,marginBottom:2},message:{width:'100%',height:40,borderRadius:20,borderWidth:1,borderColor:'#3665F3',alignItems:'center',justifyContent:'center'},messageText:{color:'#3665F3',fontWeight:'800',fontSize:14},
 offer:{flex:1,height:48,borderRadius:24,borderWidth:1,borderColor:'#3665F3',alignItems:'center',justifyContent:'center'},offerText:{color:'#3665F3',fontWeight:'800'},buy:{flex:1,height:48,borderRadius:24,backgroundColor:'#3665F3',alignItems:'center',justifyContent:'center'},buyText:{color:'#fff',fontWeight:'800'}
});