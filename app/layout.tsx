import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "世界通行方向 · Driving Sides",
  description: "旋转地球仪，探索世界各个国家和地区靠左或靠右行驶。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
