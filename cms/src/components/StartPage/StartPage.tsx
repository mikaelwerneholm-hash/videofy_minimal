"use client";
import { useEffect, useRef } from "react";
import { useReactive } from "ahooks";
import { generateManuscript } from "@/utils/generateManuscript";
import { useGlobalState } from "@/state/globalState";
import { Config } from "@videofy/types";
import Cookies from "universal-cookie";
import {
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Spin,
} from "antd";
import { useRouter } from "next/navigation";
import {
  getBrands,
  getConfigs,
  getProjects,
  runFetcherPlugin,
  setProjectBrand,
  useBrands,
  useFetchers,
} from "@/api";
import { LoadingOutlined, VideoCameraOutlined } from "@ant-design/icons";
import Image from "next/image";

const cookies = new Cookies();

const FETCHER_ID = "web";
const BRAND_ID = "2secure";

const DURATION_OPTIONS = [
  { value: 10, label: "10 sekunder" },
  { value: 15, label: "15 sekunder" },
  { value: 20, label: "20 sekunder" },
  { value: 25, label: "25 sekunder" },
  { value: 30, label: "30 sekunder" },
];

type FormType = {
  prompt: string;
  inputs: Record<string, string>;
  targetDuration: number;
};

const StartPage = () => {
  const { data: fetchers, isLoading: loadingFetchers } = useFetchers();
  const { data: brands, isLoading: loadingBrands } = useBrands();

  const state = useReactive({
    loading: false,
    loadingMessage: "Skapar video...",
  });
  const { notification } = App.useApp();
  const {
    setConfig,
    setCustomPrompt,
    setTabs,
    setCurrentTabIndex,
    setGenerationId,
    setSelectedProject,
  } = useGlobalState();

  const [form] = Form.useForm<FormType>();
  const lastSyncedBrand = useRef(false);

  useEffect(() => {
    if (!brands || brands.length === 0 || lastSyncedBrand.current) return;
    const brand = brands.find((b) => b.id === BRAND_ID) || brands[0];
    form.setFieldsValue({ prompt: brand.scriptPrompt || "" });
    lastSyncedBrand.current = true;
  }, [brands, form]);

  const router = useRouter();

  const loadManuscript = async (values: FormType) => {
    const customPrompt = (values.prompt || "").trim();

    const brand =
      brands?.find((item) => item.id === BRAND_ID) ||
      (await getBrands()).find((item) => item.id === BRAND_ID);
    if (!brand) {
      notification.error({ title: "Varumärket 2Secure hittades inte." });
      return;
    }

    state.loading = true;
    state.loadingMessage = "Hämtar innehåll...";
    try {
      const fetchResult = await runFetcherPlugin({
        fetcherId: FETCHER_ID,
        inputs: values.inputs || {},
      });

      state.loadingMessage = "Tillämpar varumärkesinställningar...";
      await setProjectBrand(fetchResult.projectId, BRAND_ID);

      state.loadingMessage = "Laddar projektkonfiguration...";
      const [projects, configs] = await Promise.all([getProjects(), getConfigs()]);
      const project = projects.find((p) => p.id === fetchResult.projectId) || {
        id: fetchResult.projectId,
        name: fetchResult.projectId,
      };
      setSelectedProject(project);

      const configRow = configs.find((c) => c.projectId === fetchResult.projectId);
      const config = configRow?.config;
      if (!configRow || !config) {
        throw new Error(`Konfiguration hittades inte för projekt '${fetchResult.projectId}'`);
      }

      const customizedConfig: Config = {
        ...config,
        manuscript: {
          ...config.manuscript,
          script_prompt: customPrompt || config.manuscript.script_prompt,
        },
      };

      setConfig({ ...configRow, config: customizedConfig });

      state.loadingMessage = "Genererar manus...";
      const manuscript = await generateManuscript(
        fetchResult.projectId,
        customizedConfig,
        values.targetDuration ?? 15,
      );

      if (!manuscript) {
        throw new Error("Inget manus returnerades från servern");
      }

      const cleanedManuscript = {
        ...manuscript,
        meta: {
          ...manuscript.meta,
          articleUrl: fetchResult.projectId,
          uniqueId: crypto.randomUUID(),
        },
      };

      const tabsData = [
        {
          articleUrl: fetchResult.projectId,
          projectId: fetchResult.projectId,
          manuscript: cleanedManuscript,
        },
      ];
      setTabs(tabsData);
      setCustomPrompt(customPrompt);
      setCurrentTabIndex(0);

      const response = await fetch("/api/generations", {
        method: "POST",
        body: JSON.stringify({
          projectId: fetchResult.projectId,
          brandId: BRAND_ID,
          config: customizedConfig,
          project,
          data: tabsData,
        }),
      });
      if (!response.ok) {
        throw new Error("Kunde inte skapa generation");
      }
      const { id: generationId } = await response.json();

      setGenerationId(generationId);
      cookies.set("projectId", fetchResult.projectId);

      router.push(`/${encodeURIComponent(generationId)}`);
    } catch (error) {
      if (error instanceof Error) {
        notification.error({ title: error.message, duration: 0 });
      } else {
        notification.error({ title: "Kunde inte hämta innehåll", duration: 0 });
      }
    } finally {
      state.loading = false;
      state.loadingMessage = "Skapar video...";
    }
  };

  if (loadingFetchers || loadingBrands) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin description="Laddar..." />
      </Flex>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f4f8" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "#05141F",
        padding: "0 40px",
        height: 64,
        display: "flex",
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        <Image
          src="/assets/2secure-logo-neg.png"
          alt="2Secure"
          width={120}
          height={36}
          style={{ objectFit: "contain" }}
        />
      </header>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #05141F 0%, #03556D 100%)",
        padding: "64px 40px 80px",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "rgba(126,179,188,0.2)",
          marginBottom: 20,
        }}>
          <VideoCameraOutlined style={{ fontSize: 26, color: "#7EB3BC" }} />
        </div>
        <h1 style={{
          color: "#FFFFFF",
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          margin: "0 0 12px",
        }}>
          Videomaker
        </h1>
        <p style={{
          color: "#7EB3BC",
          fontSize: 17,
          margin: 0,
          maxWidth: 480,
          marginInline: "auto",
        }}>
          Klistra in en URL — vi skapar ett färdigt videomanus åt dig.
        </p>
      </div>

      {/* Form card */}
      <div style={{
        maxWidth: 680,
        margin: "-32px auto 60px",
        padding: "0 24px",
      }}>
        <Card
          style={{
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(5,20,31,0.12)",
            border: "none",
          }}
          styles={{ body: { padding: "32px 36px" } }}
        >
          <Form form={form} onFinish={loadManuscript} layout="vertical" initialValues={{ targetDuration: 15 }}>
            <Form.Item
              name={["inputs", "url"]}
              label={
                <span style={{ fontWeight: 600, color: "#05141F", fontSize: 14 }}>
                  Artikel-URL
                </span>
              }
              rules={[{ required: true, message: "Ange en URL" }]}
              style={{ marginBottom: 20 }}
            >
              <Input
                placeholder="https://www.example.com/artikel..."
                size="large"
                style={{ borderRadius: 8, borderColor: "#d0dde6" }}
              />
            </Form.Item>

            <Form.Item
              name="targetDuration"
              label={
                <span style={{ fontWeight: 600, color: "#05141F", fontSize: 14 }}>
                  Klipplängd
                </span>
              }
              style={{ marginBottom: 20 }}
            >
              <Select
                options={DURATION_OPTIONS}
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              label={
                <span style={{ fontWeight: 600, color: "#05141F", fontSize: 14 }}>
                  Anpassat manus-prompt{" "}
                  <span style={{ fontWeight: 400, color: "#7EB3BC" }}>(valfritt)</span>
                </span>
              }
              name="prompt"
              style={{ marginBottom: 24 }}
            >
              <Input.TextArea
                rows={8}
                style={{ borderRadius: 8, borderColor: "#d0dde6", fontSize: 13, color: "#333" }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              {state.loading ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<LoadingOutlined spin />}
                  disabled
                  style={{
                    backgroundColor: "#03556D",
                    borderColor: "#03556D",
                    borderRadius: 8,
                    height: 48,
                    paddingInline: 32,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  {state.loadingMessage}
                </Button>
              ) : (
                <Button
                  htmlType="submit"
                  type="primary"
                  size="large"
                  icon={<VideoCameraOutlined />}
                  style={{
                    backgroundColor: "#03556D",
                    borderColor: "#03556D",
                    borderRadius: 8,
                    height: 48,
                    paddingInline: 32,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  Skapa video
                </Button>
              )}
            </Form.Item>
          </Form>
        </Card>
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        paddingBottom: 32,
        color: "#8fa3b1",
        fontSize: 13,
      }}>
        © 2Secure AB – Kontrollerar risk. Skapar trygghet.
      </footer>
    </div>
  );
};

export default StartPage;
