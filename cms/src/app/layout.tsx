import type { Metadata } from "next";
import { type ReactNode } from "react";
import "./globals.css";
import Main from "./Main";
import { AntdRegistry } from "@ant-design/nextjs-registry";

export const metadata: Metadata = {
  title: "2Secure Videomaker",
  description: "Skapa och redigera videor för 2Secure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <AntdRegistry>
      <Main>{children}</Main>
    </AntdRegistry>
  );
}
