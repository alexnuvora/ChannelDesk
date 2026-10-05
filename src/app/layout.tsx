import type {Metadata} from "next";import {Nunito_Sans} from "next/font/google";import "./globals.css";
const nunito=Nunito_Sans({subsets:["latin"],variable:"--font-body",display:"swap"});
export const metadata:Metadata={title:{default:"ChannelDesk",template:"%s | ChannelDesk"},description:"Plan, publish and understand every social channel from one intelligent workspace."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={nunito.variable}>{children}</body></html>;}