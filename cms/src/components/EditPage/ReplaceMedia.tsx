import { MediaAssetType } from "@videofy/types";
import { Alert, Button, Collapse } from "antd";
import MediaAsset from "./MediaAsset";
import { useReactive } from "ahooks";

interface ReplaceMediaProps {
  alternativeMedia?: MediaAssetType[];
  onSelectMedia: (asset: MediaAssetType) => void;
}

const ReplaceMedia = ({
  alternativeMedia,
  onSelectMedia,
}: ReplaceMediaProps) => {
  const state = useReactive({
    activeKey: undefined as string | string[] | undefined,
  });

  if (!alternativeMedia || alternativeMedia.length === 0) {
    return null;
  }

  const handleChangeCollapse = (key: string | string[]) => {
    state.activeKey = key;
  };

  return (
    <Collapse
      activeKey={state.activeKey}
      onChange={handleChangeCollapse}
      items={[
        {
          key: "1",
          label: "Annat media från artikeln",
          children: (
            <div className="gap-4 grid grid-cols-2">
              {alternativeMedia.map((i, index) => (
                <div key={index} className="gap-2 grid grid-cols-1">
                  <MediaAsset editable={false} value={i} />
                  <Button
                    onClick={() => {
                      onSelectMedia(i);
                      state.activeKey = undefined;
                    }}
                    type="primary"
                    block
                  >
                    Välj
                  </Button>
                </div>
              ))}
            </div>
          ),
        },
        {
          key: "2",
          label: "Externt mediabibliotek",
          children: (
            <Alert
              type="info"
              message="Externa mediebibliotek är inaktiverade i denna version."
            />
          ),
        },
      ]}
    />
  );
};

export default ReplaceMedia;
