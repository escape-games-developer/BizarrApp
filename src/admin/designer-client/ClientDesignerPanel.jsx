import { useMemo, useState } from "react";
import ClientDesignerLayout    from "./ClientDesignerLayout";
import ClientDesignerTabs      from "./ClientDesignerTabs";
import SavedDesignsPanel       from "./SavedDesignsPanel";
import ClientDesignerWorkspace from "./ClientDesignerWorkspace";
import ClientDesignerEditor    from "./ClientDesignerEditor";
import {
  CLIENT_DESIGN_SECTIONS, DEFAULT_CLIENT_DESIGN_SECTION, clientDesignSectionById,
} from "./clientDesignSections";
import { designsForSection, ACTIVATABLE_SECTIONS } from "./temporaryDesignCatalog";
import { useActiveClientDesigns } from "./useActiveClientDesigns";

const WORKSPACE_ID = "cd-workspace";

/** Diseño a mostrar al entrar a una sección: el activo, o el primero. */
const designInicial = (sectionId) => {
  const designs = designsForSection(sectionId);
  return (designs.find((d) => d.isActive) ?? designs[0])?.id ?? null;
};

/**
 * Admin → Diseñador Cliente: diseños visuales de la app Cliente, por sección.
 *
 * Estructura base: pestañas de sección, Diseños Guardados a la izquierda y el
 * área de diseño al centro. La columna de propiedades (derecha) se suma
 * pasándole `right` al layout cuando exista el editor.
 *
 * El estado de UI vive acá (pestaña y diseño seleccionados) y no se persiste.
 * Lo único que se guarda es el diseño activo de las secciones activables
 * (client_design_active), con el botón «Activar» del área central. Los diseños salen del catálogo temporal, que se reemplazará por el
 * backend de variantes.
 */
export default function ClientDesignerPanel() {
  const [sectionId, setSectionId] = useState(DEFAULT_CLIENT_DESIGN_SECTION);
  const [selectedId, setSelectedId] = useState(() => designInicial(DEFAULT_CLIENT_DESIGN_SECTION));

  const section = clientDesignSectionById(sectionId);
  const { active, activar } = useActiveClientDesigns();
  const activeKey = active[sectionId] ?? null;
  const designs = useMemo(() => designsForSection(sectionId, activeKey), [sectionId, activeKey]);
  const selected = designs.find((d) => d.id === selectedId) ?? null;

  const cambiarSeccion = (id) => {
    if (id === sectionId) return;
    setSectionId(id);
    setSelectedId(designInicial(id));
  };

  const tabs = <ClientDesignerTabs sections={CLIENT_DESIGN_SECTIONS} activeId={sectionId}
    onChange={cambiarSeccion} panelId={WORKSPACE_ID}/>;
  const savedDesigns = <SavedDesignsPanel designs={designs} selectedId={selectedId} onSelect={setSelectedId}/>;
  const tabpanelProps = { id: WORKSPACE_ID, role: "tabpanel", "aria-labelledby": `cd-tab-${sectionId}` };

  // Un diseño con documento del motor se abre en el editor (capas + propiedades).
  // El borrador vive en el editor: cambiar de diseño o de pestaña lo descarta.
  if (selected?.document) {
    return <ClientDesignerEditor key={selected.id} design={selected} section={section}
      tabs={tabs} savedDesigns={savedDesigns} tabpanelProps={tabpanelProps}/>;
  }

  return (
    <ClientDesignerLayout
      tabs={tabs}
      left={savedDesigns}
      center={
        <div {...tabpanelProps}>
          <ClientDesignerWorkspace section={section} design={selected}
            onActivate={ACTIVATABLE_SECTIONS.has(sectionId) ? (designKey) => activar(sectionId, designKey) : null}/>
        </div>
      }
    />
  );
}
