export type DesignerTarget = "client" | "admin" | "giant";
export type DesignerElementType = "background" | "text" | "image" | "imageButton" | "button" | "container" | "shape" | "divider" | "spacer" | "video" | "icon" | "input" | "section" | "row" | "column" | "stack" | "grid" | "systemComponent" | "unsupported";

export interface DesignerElement {
  id: string;
  name: string;
  type: DesignerElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  systemElement?: boolean;
  parentId?: string;
  positionMode?: "auto" | "free";
  action?: import("../actions/actionTypes").DesignerAction;
  layout?: {
    direction?: "row" | "column";
    gap?: number | string;
    padding?: string;
    margin?: string;
    alignItems?: string;
    justifyContent?: string;
    width?: string;
    height?: string;
    minHeight?: string;
    maxWidth?: string;
    flexGrow?: number;
    columns?: string;
  };
  zIndex: number;
  styles: Record<string, string | number>;
  props: Record<string, unknown>;
  binding?: { source: string; field: string };
  source?: { imported: boolean; sourceScreen: string; sourceTag?: string; sourceId?: string; sourceClass?: string; designerId?: string; componentId?: string; route?: string };
  responsive?: Record<string, Partial<DesignerElement>>;
}

export interface DesignerPage {
  id: string;
  name: string;
  background: { type: "color" | "gradient" | "image" | "video" | "transparent"; value: string };
  elements: DesignerElement[];
}

export interface DesignerDocument {
  version: 1 | 2;
  target: DesignerTarget;
  layoutMode?: "free" | "responsive";
  viewport: { width: number; height: number; breakpoint?: "desktop" | "tablet" | "mobile" };
  pages: DesignerPage[];
}
