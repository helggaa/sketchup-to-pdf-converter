import React, { createContext, useContext, useReducer } from 'react';
import type { AppState, PresetViewName, AnnotationData } from '../types';
import { PRESET_VIEWS } from '../types';

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

function buildDefaultAnnotations(): Record<PresetViewName, AnnotationData> {
  const entries = Object.keys(PRESET_VIEWS) as PresetViewName[];
  return Object.fromEntries(
    entries.map((name) => [name, { title: name, scaleLabel: '' }])
  ) as Record<PresetViewName, AnnotationData>;
}

function buildDefaultThumbnails(): Record<PresetViewName, string> {
  const entries = Object.keys(PRESET_VIEWS) as PresetViewName[];
  return Object.fromEntries(entries.map((name) => [name, ''])) as Record<
    PresetViewName,
    string
  >;
}

export function createInitialState(): AppState {
  return {
    uploadedFile: null,
    parseStatus: 'idle',
    parseError: null,
    model: null,

    selectedViews: new Set<PresetViewName>(),
    activePreviewView: 'Isometric',

    annotationEnabled: false,
    annotations: buildDefaultAnnotations(),

    thumbnails: buildDefaultThumbnails(),

    exportStatus: 'idle',
    exportError: null,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AppAction =
  | { type: 'SET_UPLOADED_FILE'; file: File }
  | { type: 'SET_PARSE_STATUS'; status: AppState['parseStatus'] }
  | { type: 'SET_PARSE_ERROR'; error: string | null }
  | { type: 'SET_MODEL'; model: AppState['model'] }
  | { type: 'TOGGLE_VIEW'; viewName: PresetViewName }
  | { type: 'SET_ACTIVE_PREVIEW_VIEW'; viewName: PresetViewName }
  | { type: 'SET_ANNOTATION_ENABLED'; enabled: boolean }
  | {
      type: 'SET_ANNOTATION';
      viewName: PresetViewName;
      annotation: AnnotationData;
    }
  | { type: 'SET_THUMBNAIL'; viewName: PresetViewName; dataUrl: string }
  | { type: 'SET_EXPORT_STATUS'; status: AppState['exportStatus'] }
  | { type: 'SET_EXPORT_ERROR'; error: string | null }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFile: action.file };

    case 'SET_PARSE_STATUS':
      return { ...state, parseStatus: action.status };

    case 'SET_PARSE_ERROR':
      return { ...state, parseError: action.error };

    case 'SET_MODEL':
      return { ...state, model: action.model, thumbnails: buildDefaultThumbnails() };

    case 'TOGGLE_VIEW': {
      const next = new Set(state.selectedViews);
      if (next.has(action.viewName)) {
        next.delete(action.viewName);
      } else {
        next.add(action.viewName);
      }
      return { ...state, selectedViews: next };
    }

    case 'SET_ACTIVE_PREVIEW_VIEW':
      return { ...state, activePreviewView: action.viewName };

    case 'SET_ANNOTATION_ENABLED':
      return { ...state, annotationEnabled: action.enabled };

    case 'SET_ANNOTATION':
      return {
        ...state,
        annotations: {
          ...state.annotations,
          [action.viewName]: action.annotation,
        },
      };

    case 'SET_THUMBNAIL':
      return {
        ...state,
        thumbnails: {
          ...state.thumbnails,
          [action.viewName]: action.dataUrl,
        },
      };

    case 'SET_EXPORT_STATUS':
      return { ...state, exportStatus: action.status };

    case 'SET_EXPORT_ERROR':
      return { ...state, exportError: action.error };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an <AppProvider>');
  }
  return ctx;
}

export default AppContext;
