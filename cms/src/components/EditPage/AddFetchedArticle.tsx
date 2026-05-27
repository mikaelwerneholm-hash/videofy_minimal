"use client";

import { useEffect, type FC } from "react";
import { useReactive } from "ahooks";
import { App, Button, Form, Input, Modal, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { runFetcherPlugin, setProjectBrand } from "@/api";
import { generateManuscript } from "@/utils/generateManuscript";
import { Tab, useGlobalState } from "@/state/globalState";

const FETCHER_ID = "web";

type FormType = {
  inputs: Record<string, string>;
};

type AddFetchedArticleProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  brandId: string;
  onChange: (tab: Tab) => Promise<void>;
};

const AddFetchedArticle: FC<AddFetchedArticleProps> = ({
  open,
  setOpen,
  brandId,
  onChange,
}) => {
  const [form] = Form.useForm<FormType>();
  const { config } = useGlobalState();
  const { notification } = App.useApp();

  const state = useReactive({
    loading: false,
    loadingMessage: "Hämtar artikel...",
  });

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ inputs: {} });
  }, [open, form]);

  const handleClose = () => {
    if (state.loading) return;
    setOpen(false);
    form.resetFields();
  };

  const handleAddArticle = async (values: FormType) => {
    if (!config?.config) {
      notification.error({ title: "Konfigurationen är inte laddad ännu." });
      return;
    }
    state.loading = true;
    state.loadingMessage = "Hämtar artikel...";
    try {
      const fetchResult = await runFetcherPlugin({
        fetcherId: FETCHER_ID,
        inputs: values.inputs || {},
      });

      state.loadingMessage = "Tillämpar varumärkesinställningar...";
      await setProjectBrand(fetchResult.projectId, brandId || "2secure");

      state.loadingMessage = "Genererar manus...";
      const manuscript = await generateManuscript(fetchResult.projectId, config.config);
      const cleanedManuscript = {
        ...manuscript,
        meta: {
          ...manuscript.meta,
          articleUrl: fetchResult.projectId,
          uniqueId: crypto.randomUUID(),
        },
      };

      await onChange({
        articleUrl: fetchResult.projectId,
        projectId: fetchResult.projectId,
        manuscript: cleanedManuscript,
      });

      setOpen(false);
      form.resetFields();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kunde inte lägga till artikel";
      notification.error({ title: message, duration: 0 });
    } finally {
      state.loading = false;
      state.loadingMessage = "Hämtar artikel...";
    }
  };

  return (
    <Modal
      title="Lägg till artikel"
      open={open}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={state.loading}>
          Avbryt
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={state.loading ? <LoadingOutlined spin /> : undefined}
          onClick={() => form.submit()}
        >
          {state.loading ? state.loadingMessage : "Lägg till artikel"}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" onFinish={handleAddArticle}>
        <Form.Item
          name={["inputs", "url"]}
          label="Artikel-URL"
          rules={[{ required: true, message: "Ange en URL" }]}
        >
          <Input placeholder="https://www.example.com/artikel..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddFetchedArticle;
