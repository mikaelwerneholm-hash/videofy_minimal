"use client";
import { StyleProvider } from "@ant-design/cssinjs";
import { App, ConfigProvider, Layout, theme } from "antd";
import type { ReactNode } from "react";

export default function Main({ children }: { children: ReactNode }) {
  return (
    <StyleProvider layer>
      <ConfigProvider
        wave={{ disabled: true }}
        theme={{
          hashed: false,
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: "#03556D",
            fontSize: 16,
            fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
            colorBgBase: "#FFFFFF",
            colorBgContainer: "#F8FAFC",
            colorBgElevated: "#FFFFFF",
          },
          components: {
            TreeSelect: {
              indentSize: 12,
              controlItemBgHover: "rgba(0,0,0,0.04)",
            },
            Tabs: {
              colorPrimary: "#03556D",
              itemActiveColor: "#03556D",
            },
          },
        }}
      >
        <html
          lang="sv"
          style={{ height: "100%" }}
        >
          <body style={{ height: "100%", margin: 0 }}>
            <Layout style={{ minHeight: "100vh" }}>
              <App message={{ duration: 10 }}>{children}</App>
            </Layout>
          </body>
        </html>
      </ConfigProvider>
    </StyleProvider>
  );
}
