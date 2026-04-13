import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display/cubism4";
import { useLive2DStore } from "../../stores/live2dStore";
import { useCharacterStore } from "../../stores/characterStore";

// pixi-live2d-display requires window.PIXI for PixiJS v7
(window as unknown as Record<string, unknown>).PIXI = PIXI;

// Patch: BatchRenderer.contextChange can fail when MAX_TEXTURE_IMAGE_UNITS returns 0
const origContextChange = PIXI.BatchRenderer.prototype.contextChange;
PIXI.BatchRenderer.prototype.contextChange = function (this: PIXI.BatchRenderer) {
  try {
    origContextChange.call(this);
  } catch {
    // Fallback for GPU drivers that report 0 max textures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    self.maxTextures = 1;
    self._shader = self.shaderGenerator.generateShader(1);
    for (let i = 0; i < self._packedGeometryPoolSize; i++) {
      self._packedGeometries[i] = new self.geometryClass();
    }
  }
};

// Patch: pixi-live2d-display@0.4.0 calls renderer.plugins.interaction.on()
// in _render(), but PixiJS 7.4 replaced InteractionManager with EventSystem
// which lacks .on(). Disable registerInteraction entirely since we handle
// mouse tracking and tap manually (autoInteract: false).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Live2DModel.prototype as any).registerInteraction = function () {};

Live2DModel.registerTicker(PIXI.Ticker);

export function Live2DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const modelRef = useRef<InstanceType<typeof Live2DModel> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { selectedCharacter } = useCharacterStore();
  const { currentEmotion } = useLive2DStore();

  // Initialize PixiJS app
  // NOTE: No cleanup — PixiJS loses the WebGL context on destroy(), and
  // re-creating an Application on the same canvas produces a broken renderer.
  // React StrictMode double-invokes effects, so we skip if already initialised.
  // The canvas removal on unmount triggers automatic context loss / GC.
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    try {
      const app = new PIXI.Application({
        view: canvasRef.current,
        resizeTo: window,
        backgroundAlpha: 0,
      });
      appRef.current = app;
    } catch (error) {
      console.error("Failed to initialize PixiJS:", error);
      setLoadError(true);
    }
  }, []);

  // Load model when character changes
  useEffect(() => {
    if (!appRef.current || !selectedCharacter) return;

    const app = appRef.current;
    let cancelled = false;
    let onMouseMove: ((e: MouseEvent) => void) | null = null;
    let onClick: ((e: MouseEvent) => void) | null = null;

    async function loadModel() {
      if (modelRef.current) {
        app.stage.removeChild(modelRef.current);
        modelRef.current = null;
      }
      setLoadError(false);

      try {
        // autoInteract must be disabled via options — the library's init()
        // defaults it to true BEFORE we can set it on the instance, and the
        // first _render() call would crash because PixiJS 7.4 replaced
        // InteractionManager with EventSystem (renderer.plugins.interaction
        // lacks .on()). We handle mouse tracking and tap manually below.
        const model = await Live2DModel.from(selectedCharacter!.modelPath, {
          autoInteract: false,
        });
        if (cancelled) return;

        model.anchor.set(0.5, 0.5);
        model.position.set(app.screen.width / 2, app.screen.height / 2);

        const scale = Math.min(
          app.screen.width / model.width,
          app.screen.height / model.height,
        ) * 0.8;
        model.scale.set(scale);

        app.stage.addChild(model);
        modelRef.current = model;

        onMouseMove = (e: MouseEvent) => {
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

        // Manual tap for hit-area detection (replaces InteractionManager)
        const canvas = canvasRef.current;
        if (canvas) {
          onClick = (e: MouseEvent) => {
            model.tap(e.clientX, e.clientY);
          };
          canvas.addEventListener("click", onClick);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load Live2D model:", error);
        setLoadError(true);
      }
    }

    loadModel();

    return () => {
      cancelled = true;
      if (onMouseMove) {
        window.removeEventListener("mousemove", onMouseMove);
      }
      if (onClick && canvasRef.current) {
        canvasRef.current.removeEventListener("click", onClick);
      }
    };
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
    const app = appRef.current;

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

    app.ticker.add(updateMouth);
    return () => {
      if (app.ticker) {
        try { app.ticker.remove(updateMouth); } catch { /* app already destroyed */ }
      }
    };
  }, []);

  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-600">
        <p>Live2D モデルを読み込めませんでした</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
    />
  );
}
