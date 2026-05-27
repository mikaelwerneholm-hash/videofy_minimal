"use client";
import type { processedManuscriptSchema } from "@videofy/types";
import { processManuscript } from "@/utils/processManuscript";
import type { PlayerRef } from "@remotion/player";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useReactive } from "ahooks";
import type { z } from "zod";
import { Player } from "@videofy/player";
import ErrorCard from "./ErrorCard";
import LoadingCard from "./LoadingCard";
import { Tab, useGlobalState } from "@/state/globalState";
import { BorderOutlined, DesktopOutlined, MobileOutlined, SyncOutlined, DownloadOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Select, Segmented, Tooltip, theme as antdTheme } from "antd";
import DownloadModal from "./DownloadModal";

type VoiceOption = { id: string; name: string };

type Result = z.infer<typeof processedManuscriptSchema>;

const PreviewOutput = ({ tabs }: { tabs: Tab[] }) => {
  const state = useReactive({
    loading: true,
    updating: false,
    error: null as string | null,
    previewType: "Vertical" as "Vertical" | "Horizontal" | "Square",
    downloadOpen: false,
    voices: [] as VoiceOption[],
  });
  const abortController = useRef(new AbortController());
  const initialized = useRef(false);

  const {
    config: { config },
    processedManuscripts,
    setProcessedManuscripts,
    generationId,
    selectedVoiceId,
    setSelectedVoiceId,
  } = useGlobalState();

  const playerRef = useRef<PlayerRef>(null);

  const handleError = useCallback(
    (error: unknown) => {
      console.error(error);
      setProcessedManuscripts([]);
      if (typeof error === "string") {
        state.error = error || "Okänt fel.";
      } else if (error instanceof Error) {
        state.error = error?.message || "Okänt fel.";
      } else {
        state.error = "Okänt fel.";
      }
    },
    [setProcessedManuscripts, state]
  );

  const fetchData = useCallback(
    async (updating = false) => {
      if (!(tabs && config)) return;

      try {
        initialized.current = true;

        if (updating) {
          state.updating = true;
        } else {
          state.loading = true;
        }
        const results = await Promise.all(
          tabs.map((tab) =>
            processManuscript({
              abortController: abortController.current,
              manuscript: tab.manuscript,
              config: config,
              uniqueId: tab.manuscript.meta.uniqueId!,
              projectId: tab.projectId || generationId || tab.articleUrl,
              backendGenerationId: tab.backendGenerationId,
              voiceId: selectedVoiceId,
            })
          )
        );

        state.error = null;
        setProcessedManuscripts(
          results.filter((result) => result !== null) as Array<Result>
        );
        if (playerRef.current) playerRef.current.seekTo(0);
      } catch (error) {
        handleError(error);
      } finally {
        if (updating) {
          state.updating = false;
        } else {
          state.loading = false;
        }
        initialized.current = false;
      }
    },
    [config, generationId, handleError, selectedVoiceId, setProcessedManuscripts, state, tabs]
  );

  const updatePreview = async () => {
    if (playerRef.current) playerRef.current.pause();
    await fetchData(true);
    await fetch("/api/generations", {
      method: "PUT",
      body: JSON.stringify({
        id: generationId || tabs[0]?.projectId || tabs[0]?.articleUrl,
        data: tabs,
      }),
    });
  };

  useEffect(() => {
    if (initialized.current) return;
    if (playerRef.current) playerRef.current.pause();
    fetchData();
  }, []);

  const prevVoiceIdRef = useRef<string | undefined>(selectedVoiceId);
  useEffect(() => {
    const prev = prevVoiceIdRef.current;
    prevVoiceIdRef.current = selectedVoiceId;
    if (prev === selectedVoiceId || selectedVoiceId === undefined) return;
    if (playerRef.current) playerRef.current.pause();
    void fetchData(true);
  }, [selectedVoiceId, fetchData]);

  useEffect(() => {
    if (!generationId) return;
    fetch(`/api/voices?projectId=${encodeURIComponent(generationId)}`)
      .then((r) => r.json())
      .then((data: { voices?: VoiceOption[] }) => {
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          state.voices = data.voices;
        }
      })
      .catch(() => {});
  }, [generationId, state]);

  const playerConfig = useMemo(
    () => ({
      ...config.player!,
      assetBaseUrl:
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_CMS_BASE_URL || "http://127.0.0.1:3000",
    }),
    [config.player]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Player area */}
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
        {state.error && !state.updating && !state.loading ? (
          <ErrorCard errorMessage={state.error} />
        ) : !processedManuscripts.length && (state.updating || state.loading) ? (
          <LoadingCard />
        ) : (
          <Player
            ref={playerRef}
            height={state.previewType === "Vertical" ? 1920 : 1080}
            width={state.previewType === "Square" ? 1080 : state.previewType === "Vertical" ? 1080 : 1920}
            manuscripts={processedManuscripts}
            playerConfig={playerConfig}
            style={{
              maxHeight: state.previewType === "Vertical" ? "75dvh" : state.previewType === "Square" ? "70dvh" : undefined,
              width: "100%",
              aspectRatio: state.previewType === "Vertical" ? "9/16" : state.previewType === "Square" ? "1/1" : "16/9",
            }}
          />
        )}
        {(state.loading || state.updating) && processedManuscripts.length > 0 && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(5,20,31,0.6)",
            borderRadius: 8,
          }}>
            <span style={{ color: "#7EB3BC", fontWeight: 600, fontSize: 14 }}>
              Uppdaterar förhandsvisning...
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 14 }}>

        {/* Voice row */}
        {state.voices.length > 0 && (
          <ConfigProvider
            theme={{
              algorithm: antdTheme.darkAlgorithm,
              token: {
                colorPrimary: "#7EB3BC",
                colorBgContainer: "#2a3f4d",
                colorBgElevated: "#1e3340",
                colorText: "#e0eef2",
                colorTextPlaceholder: "#7EB3BC",
                colorBorder: "#3a5565",
                controlHeight: 32,
                borderRadius: 6,
                fontSize: 13,
              },
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
              <span style={{
                color: "#7EB3BC",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                Röst
              </span>
              <Select
                value={selectedVoiceId ?? state.voices[0]?.id}
                onChange={(v) => setSelectedVoiceId(v)}
                options={state.voices.map((v) => ({ value: v.id, label: v.name }))}
                style={{ flex: 1, minWidth: 0 }}
                popupMatchSelectWidth={false}
                disabled={state.loading || state.updating}
              />
            </div>
          </ConfigProvider>
        )}

        {/* Format + action buttons row */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Tooltip title="Byt format">
            <Segmented
              options={[
                { value: "Vertical", icon: <MobileOutlined /> },
                { value: "Square", icon: <BorderOutlined /> },
                { value: "Horizontal", icon: <DesktopOutlined /> },
              ]}
              value={state.previewType}
              onChange={(value) => { state.previewType = value as "Horizontal" | "Vertical" | "Square"; }}
              style={{ backgroundColor: "#2a3f4d" }}
            />
          </Tooltip>
          <Button
            onClick={updatePreview}
            disabled={state.loading || state.updating}
            icon={<SyncOutlined spin={state.updating} />}
            style={{
              backgroundColor: "#03556D",
              borderColor: "#03556D",
              color: "#fff",
              borderRadius: 6,
            }}
          >
            Uppdatera
          </Button>
          {!state.error && processedManuscripts.length > 0 && (
            <Button
              disabled={state.loading || state.updating}
              icon={<DownloadOutlined />}
              style={{
                backgroundColor: "#7EB3BC",
                borderColor: "#7EB3BC",
                color: "#05141F",
                fontWeight: 600,
                borderRadius: 6,
              }}
              onClick={() => {
                updatePreview();
                state.downloadOpen = true;
              }}
            >
              Ladda ned
            </Button>
          )}
        </div>
      </div>

      <DownloadModal
        open={state.downloadOpen}
        setOpen={(open) => (state.downloadOpen = open)}
      />
    </div>
  );
};

export default memo(PreviewOutput);
