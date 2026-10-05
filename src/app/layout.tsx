import type { Metadata } from "next";import {DM_Sans,Manrope} from "next/font/google";import "./globals.css";
const body=DM_Sans({subsets:["latin"],variable:"--font-body",display:"swap"});const display=Manrope({subsets:["latin"],variable:"--font-display",display:"swap"});
export const metadata:Metadata={title:{default:"ChannelDesk",template:"%s | ChannelDesk"},description:"Plan, publish and understand every social channel from one intelligent workspace."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={body.variable+" "+display.variable}>{children}</body></html>;}
