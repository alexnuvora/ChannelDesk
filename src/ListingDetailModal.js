import React from 'react';
import {View,Text,StyleSheet,TouchableOpacity,Image,Modal,SafeAreaView,ScrollView,Dimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

const W=Dimensions.get('window').width;

export default function ListingDetailModal({listing,user,onClose,onMessage,onOffer,onBuy}){
 if(!listing)return null;
 const own=listing.sellerId===user?.uid;
 const photos=(listing.photos?.length?listing.photos:[listing.img||listing.imageUrl]).filter(Boolean);
 return <Modal visible animationType="slide" onRequestClose={onClose}>
  <SafeAreaView style={s.safe}>
   <View style={s.header}>
    <TouchableOpacity accessibilityLabel="Close listing" style={s.close} onPress={onClose}><Ionicons name="close" size={25}/></TouchableOpacity>
    <Text style={s.headerTitle}>Listing</Text><View style={{width:40}}/>
   </View>
   <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={s.gallery}>
     {photos.map((uri,i)=><View key={uri+i} style={s.slide}><Image source={{uri}} style={s.image}/>{photos.length>1&&<View style={s.count}><Text style={s.countText}>{i+1}/{photos.length}</Text></View>}</View>)}
    </ScrollView>
    <View style={s.body}>
     <Text style={s.price}>{typeof listing.price==='string'?listing.price:'£'+listing.price}</Text>
     <Text style={s.title}>{listing.title}</Text>
     <Text style={s.meta}>{listing.condition||listing.meta||'Good'} · {listing.category||'Marketplace'}</Text>
     <Text style={s.description}>{listing.description||'Message the seller for more information about this item.'}</Text>
     <View style={s.seller}><Ionicons name="person-circle" size={44} color="#0A8F5A"/><View style={{flex:1}}><Text style={s.sellerName}>{listing.sellerName||'WhatBuy seller'}</Text><Text style={s.location}>{listing.place||listing.location||'United Kingdom'}</Text></View></View>
     {own&&<View style={s.own}><Ionicons name="information-circle-outline" size={20} color="#087A4D"/><Text style={s.ownText}>This is your listing. Manage it from Profile → My listings.</Text></View>}
    </View>
   </ScrollView>
   {!own&&<View style={s.footer}>
    <TouchableOpacity style={s.message} onPress={onMessage}><Ionicons name="chatbubble-outline" size={19} color="#087A4D"/><Text style={s.messageText}>Message</Text></TouchableOpacity>
    <TouchableOpacity style={s.offer} onPress={onOffer}><Text style={s.offerText}>Make offer</Text></TouchableOpacity>
    <TouchableOpacity style={s.buy} onPress={onBuy}><Text style={s.buyText}>Buy now</Text></TouchableOpacity>
   </View>}
  </SafeAreaView>
 </Modal>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#fff'},header:{height:60,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#EAECF0',backgroundColor:'#fff'},
 close:{width:40,height:40,borderRadius:20,backgroundColor:'#F2F4F7',alignItems:'center',justifyContent:'center'},headerTitle:{fontSize:18,fontWeight:'900'},
 scroll:{flex:1,minHeight:0},content:{paddingBottom:36,flexGrow:1},gallery:{height:Math.min(W,430),flexGrow:0},slide:{width:W,height:Math.min(W,430),position:'relative'},image:{width:'100%',height:'100%',resizeMode:'cover',backgroundColor:'#F2F4F7'},
 count:{position:'absolute',right:14,bottom:14,backgroundColor:'rgba(17,24,39,.72)',paddingHorizontal:10,paddingVertical:5,borderRadius:14},countText:{color:'#fff',fontWeight:'800',fontSize:12},
 body:{padding:20},price:{fontSize:28,fontWeight:'900'},title:{fontSize:22,fontWeight:'900',marginTop:5},meta:{color:'#667085',fontWeight:'600',marginTop:7},description:{fontSize:15,lineHeight:23,color:'#344054',marginVertical:18},
 seller:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:14,borderTopWidth:1,borderBottomWidth:1,borderColor:'#EAECF0'},sellerName:{fontWeight:'900',fontSize:15},location:{fontSize:12,color:'#98A2B3',marginTop:2},
 own:{flexDirection:'row',gap:8,backgroundColor:'#EAF9F2',padding:13,borderRadius:14,marginTop:16},ownText:{flex:1,color:'#087A4D',lineHeight:19,fontWeight:'600'},
 footer:{flexShrink:0,minHeight:78,paddingHorizontal:12,paddingTop:10,paddingBottom:16,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#EAECF0',flexDirection:'row',gap:8},
 message:{width:88,height:52,borderRadius:14,borderWidth:1,borderColor:'#0A8F5A',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:5},messageText:{color:'#087A4D',fontWeight:'900',fontSize:12},
 offer:{flex:1,height:52,borderRadius:14,borderWidth:1,borderColor:'#0A8F5A',alignItems:'center',justifyContent:'center'},offerText:{color:'#087A4D',fontWeight:'900'},
 buy:{flex:1,height:52,borderRadius:14,backgroundColor:'#0A8F5A',alignItems:'center',justifyContent:'center'},buyText:{color:'#fff',fontWeight:'900'}
});