"use client";

import { type FC, useEffect } from "react";
import { useReactive } from "ahooks";
import { useParams } from "next/navigation";
import { Tab, useGlobalState } from "@/state/globalState";
import { useRouter } from "next/navigation";
import { Alert, App, Button, Flex, Form, Spin, Tooltip, Typography } from "antd";
import { SettingOutlined, ShareAltOutlined } from "@ant-design/icons";
import Image from "next/image";
import PreviewOutput from "./Preview/PreviewOutput";
import SortableTabs from "../SortableTabs";
import SegmentList from "./SegmentList";
import EditConfig from "./EditConfig";
import AddFetchedArticle from "./AddFetchedArticle";

const EditPage: FC = () => {
  const {
    config,
    tabs,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    generationId,
  } = useGlobalState();
  const router = useRouter();
  const params = useParams();
  const { message, notification } = App.useApp();
  const state = useReactive({
    editTheme: false,
    selectedTab: tabs[0]?.manuscript.meta.uniqueId,
    manuscript: tabs,
    loadingGeneration: true,
    loadError: null as string | null,
    openArticleModal: false,
    brandId: "2secure",
  });

  useEffect(() => {
    const generationParam = params.generation;
    const generationId = Array.isArray(generationParam)
      ? generationParam[0]
      : generationParam;
    if (!generationId) {
      state.loadingGeneration = false;
      router.replace("/");
      return;
    }
    const fetchGeneration = async () => {
      state.loadingGeneration = true;
      state.loadError = null;
      try {
        const response = await fetch(
          `/api/generations?id=${encodeURIComponent(String(generationId))}`
        );
        if (response.status === 404) {
          notification.warning({
            title: "Projektet finns inte längre",
            description: "Generationen togs bort eller projektmappen raderades.",
          });
          router.replace("/");
          return;
        }
        if (!response.ok) {
          throw new Error("Kunde inte hämta generation");
        }
        const generation = await response.json();
        if (!generation.config || !generation.projectId) {
          throw new Error("Generationsdata saknar konfiguration eller projekt-ID");
        }
        setConfig({
          projectId: generation.projectId,
          config: generation.config,
        });
        setTabs(generation.data);
        setSelectedProject(
          generation.project || {
            id: generation.projectId,
            name: generation.projectId,
          }
        );
        setGenerationId(generation.id);
        state.brandId = generation.brandId || "2secure";
        state.selectedTab = generation.data?.[0]?.manuscript?.meta?.uniqueId;
      } catch (error) {
        console.error(error);
        state.loadError =
          error instanceof Error ? error.message : "Kunde inte ladda projektet";
      } finally {
        state.loadingGeneration = false;
      }
    };
    void fetchGeneration();
  }, [
    params,
    router,
    setConfig,
    setTabs,
    setSelectedProject,
    setGenerationId,
    notification,
    state,
  ]);

  useEffect(() => {
    if (!state.selectedTab && tabs.length > 0) {
      state.selectedTab = tabs[0]?.manuscript.meta.uniqueId;
    }
  }, [state, tabs]);

  const [form] = Form.useForm();

  const handleAddArticle = async (tab: Tab) => {
    const currentTabs = (form.getFieldValue("tabs") || []) as Tab[];
    const nextTabs = [...currentTabs, tab];
    form.setFieldValue("tabs", nextTabs);
    setTabs(nextTabs);
    state.selectedTab = tab.manuscript.meta.uniqueId;

    const idFromParams = Array.isArray(params.generation)
      ? params.generation[0]
      : params.generation;
    const persistId = generationId || String(idFromParams || "");
    if (!persistId) return;

    const response = await fetch("/api/generations", {
      method: "PUT",
      body: JSON.stringify({ id: persistId, data: nextTabs }),
    });
    if (!response.ok) {
      throw new Error("Kunde inte spara artikel");
    }
  };

  if (state.loadingGeneration || !config) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {state.loadError ? (
          <Alert
            type="error"
            message="Kunde inte ladda projekt"
            description={state.loadError}
            action={
              <Button type="primary" onClick={() => router.replace("/")}>
                Tillbaka till start
              </Button>
            }
          />
        ) : (
          <Flex vertical align="center" gap="small">
            <Spin size="large" />
            <Typography.Text style={{ color: "#03556D", fontWeight: 500 }}>
              Laddar projekt...
            </Typography.Text>
          </Flex>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f4f8", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        backgroundColor: "#05141F",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}>
        <Image
          src="/assets/2secure-logo-neg.png"
          alt="2Secure"
          width={100}
          height={30}
          style={{ objectFit: "contain", cursor: "pointer" }}
          onClick={() => router.push("/")}
        />
        <Flex gap="small">
          <Tooltip title="Dela video">
            <Button
              icon={<ShareAltOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                message.success("Video-URL kopierad till urklipp.", 5);
              }}
              style={{ borderColor: "#7EB3BC", color: "#7EB3BC", backgroundColor: "transparent" }}
            >
              Dela
            </Button>
          </Tooltip>
          <Tooltip title="Redigera inställningar">
            <Button
              type={state.editTheme ? "primary" : "default"}
              icon={<SettingOutlined />}
              onClick={() => (state.editTheme = !state.editTheme)}
              style={!state.editTheme ? { borderColor: "#7EB3BC", color: "#7EB3BC", backgroundColor: "transparent" } : {}}
            />
          </Tooltip>
        </Flex>
      </header>

      {/* Main content */}
      <Form
        preserve
        initialValues={{ tabs, config }}
        layout="vertical"
        form={form}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr minmax(0, 820px)",
          gap: 20,
          padding: "20px 20px 20px",
          flex: 1,
          alignItems: "start",
        }}>
          {/* Preview panel */}
          <div style={{
            position: "sticky",
            top: 20,
            backgroundColor: "#1a2a35",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 4px 20px rgba(5,20,31,0.18)",
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#7EB3BC",
              marginBottom: 14,
            }}>
              Förhandsvisning
            </div>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldsValue }) => {
                const manuscripts = getFieldsValue(true).tabs;
                return <PreviewOutput tabs={manuscripts} />;
              }}
            </Form.Item>
          </div>

          {/* Editor panel */}
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            boxShadow: "0 2px 12px rgba(5,20,31,0.08)",
            overflow: "hidden",
          }}>
            {/* Panel header */}
            <div style={{
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #e8eef3",
              padding: "12px 20px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#03556D",
            }}>
              {state.editTheme ? "Inställningar" : "Manus & segment"}
            </div>

            <div style={{ padding: "0 20px 20px" }}>
              {!state.editTheme ? (
                <Form.List name={["tabs"]}>
                  {(tabItems, { move }) => (
                    <SortableTabs
                      allowAdd
                      onAdd={() => { state.openArticleModal = true; }}
                      activeKey={state.selectedTab}
                      onChange={(value) => { state.selectedTab = value; }}
                      onReorder={(from, to) => { move(from, to); }}
                      items={tabItems.map((t, index) => {
                        const tab = form.getFieldValue(["tabs", t.name]);
                        return {
                          key: tab.manuscript.meta.uniqueId!,
                          label: (
                            <Flex align="center">
                              <Typography.Paragraph
                                ellipsis={{ tooltip: tab.manuscript.meta.title }}
                                style={{ maxWidth: 250, marginBottom: 0, userSelect: "none" }}
                              >
                                {tab.manuscript.meta.title}
                              </Typography.Paragraph>
                            </Flex>
                          ),
                          children: (
                            <SegmentList
                              index={t.name}
                              manuscript={tab.manuscript}
                            />
                          ),
                          forceRender: true,
                        };
                      })}
                    />
                  )}
                </Form.List>
              ) : (
                <Form.Item name="config" noStyle>
                  <EditConfig />
                </Form.Item>
              )}
            </div>
          </div>
        </div>
      </Form>

      <AddFetchedArticle
        open={state.openArticleModal}
        setOpen={(open) => { state.openArticleModal = open; }}
        brandId={state.brandId}
        onChange={handleAddArticle}
      />
    </div>
  );
};

export default EditPage;
