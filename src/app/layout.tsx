import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ChannelDesk", template: "%s | ChannelDesk" },
  description: "Plan, publish and understand every social channel from one intelligent workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
