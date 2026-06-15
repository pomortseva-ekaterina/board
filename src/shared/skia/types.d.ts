export interface FillStyle {
  visible: boolean;
  color: number;
  alpha: number;
}

export interface LineStyle {
  visible: boolean;
  width: number;
  color: number;
  alpha: number;
}

export interface GraphicsData {
  shape: Record<string, unknown>;
  fillStyle: FillStyle;
  lineStyle: LineStyle;
}

export interface LocalTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface SceneNode {
  visible: boolean;
  _type: string;
  localTransform: LocalTransform;
  graphicsData: GraphicsData[];
  children: SceneNode[];
}