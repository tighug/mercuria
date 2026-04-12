import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";
import { useLive2DStore } from "../../stores/live2dStore";
import { useCharacterStore } from "../../stores/characterStore";

// Register Live2D with PixiJS ticker
Live2DModel.registerTicker(PIXI.Ticker);

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<InstanceType<typeof Live2DModel> | null>(null);
  const { selectedCharacter } = useCharacterStore();
  const { currentEmotion } = useLive2DStore();

  // Initialize PixiJS app
  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new PIXI.Application({
      view: canvasRef.current,
      resizeTo: window,
      backgroundAlpha: 0,
    });
    appRef.current = app;

    return () => {
      app.destroy(true);
      appRef.current = null;
    };
  }, []);

  // Load model when character changes
  useEffect(() => {
    if (!appRef.current || !selectedCharacter) return;

    const app = appRef.current;

    async function loadModel() {
      if (modelRef.current) {
        app.stage.removeChild(modelRef.current);
        modelRef.current = null;
      }

      try {
        const model = await Live2DModel.from(selectedCharacter!.modelPath);
        model.anchor.set(0.5, 0.5);
        model.position.set(app.screen.width / 2, app.screen.height / 2);

        const scale = Math.min(
          app.screen.width / model.width,
          app.screen.height / model.height,
        ) * 0.8;
        model.scale.set(scale);

        app.stage.addChild(model);
        modelRef.current = model;

        const onMouseMove = (e: MouseEvent) => {
          model.focus(e.clientX, e.clientY);
        };
        window.addEventListener("mousemove", onMouseMove);

        model.on("hit", (hitAreas: string[]) => {
          if (hitAreas.includes("Head")) {
            model.motion("tap_head");
          } else if (hitAreas.includes("Body")) {
            model.motion("tap_body");
          }
        });

        return () => {
          window.removeEventListener("mousemove", onMouseMove);
        };
      } catch (error) {
        console.error("Failed to load Live2D model:", error);
      }
    }

    loadModel();
  }, [selectedCharacter]);

  // Update expression when emotion changes
  useEffect(() => {
    if (!modelRef.current || !selectedCharacter) return;
    const expressionName = selectedCharacter.emotionMap[currentEmotion] ?? "expression_default";
    modelRef.current.expression(expressionName);
  }, [currentEmotion, selectedCharacter]);

  // Lip sync
  useEffect(() => {
    if (!appRef.current) return;
    const ticker = appRef.current.ticker;

    const updateMouth = () => {
      if (modelRef.current) {
        const value = useLive2DStore.getState().mouthOpenValue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coreModel = modelRef.current.internalModel?.coreModel as any;
        if (coreModel) {
          coreModel.setParameterValueByIndex(
            coreModel.getParameterIndex("ParamMouthOpenY"),
            value,
          );
        }
      }
    };

    ticker.add(updateMouth);
    return () => { ticker.remove(updateMouth); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  );
}
