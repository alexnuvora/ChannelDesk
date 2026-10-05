import type {Metadata} from "next";import {Inter} from "next/font/google";import "./globals.css";
const inter=Inter({subsets:["latin"],variable:"--font-body",display:"swap"});
export const metadata:Metadata={title:{default:"ChannelDesk",template:"%s | ChannelDesk"},description:"Plan, publish and understand every social channel from one intelligent workspace."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={inter.variable}>{children}</body></html>;}