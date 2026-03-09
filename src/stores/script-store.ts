// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createProjectScopedStorage } from "@/lib/project-storage";
import type { ScriptData, Shot, Episode, ScriptScene, ScriptCharacter, EpisodeRawScript, ProjectBackground } from "@/types/script";
import { useRenderLogStore } from "@/stores/render-log-store";

export type ParseStatus = "idle" | "parsing" | "ready" | "error";
export type ShotListStatus = "idle" | "generating" | "ready" | "error";

export interface BatchProgress {
  current: number;
  total: number;
  message: string;
}

export interface ScriptProjectData {
  rawScript: string;
  language: string;
  targetDuration: string;
  styleId: string;
  sceneCount?: string; // 场景数量（可选）
  shotCount?: string;  // 分镜数量（可选）
  scriptData: ScriptData | null;
  parseStatus: ParseStatus;
  parseError?: string;
  shots: Shot[];
  shotStatus: ShotListStatus;
  shotError?: string;
  batchProgress: BatchProgress | null;
  characterIdMap: Record<string, string>; // scriptCharId -> characterId
  sceneIdMap: Record<string, string>; // scriptSceneId -> sceneId
  updatedAt: number;
  // 新增：完整剧本存储
  projectBackground: ProjectBackground | null;  // 项目背景（大纲、人物小传等）
  episodeRawScripts: EpisodeRawScript[];        // 各集原始剧本内容
  metadataMarkdown: string;                     // 自动生成的项目元数据 MD（作为 AI 生成的全局参考）
  metadataGeneratedAt?: number;                 // 元数据生成时间
}

interface ScriptStoreState {
  activeProjectId: string | null;
  projects: Record<string, ScriptProjectData>;
}

interface ScriptStoreActions {
  setActiveProjectId: (id: string | null) => void;
  ensureProject: (projectId: string) => void;
  setRawScript: (projectId: string, rawScript: string) => void;
  setLanguage: (projectId: string, language: string) => void;
  setTargetDuration: (projectId: string, duration: string) => void;
  setStyleId: (projectId: string, styleId: string) => void;
  setSceneCount: (projectId: string, sceneCount?: string) => void;
  setShotCount: (projectId: string, shotCount?: string) => void;
  setScriptData: (projectId: string, data: ScriptData | null) => void;
  setParseStatus: (projectId: string, status: ParseStatus, error?: string) => void;
  setShots: (projectId: string, shots: Shot[]) => void;
  updateShot: (projectId: string, shotId: string, updates: Partial<Shot>) => void;
  setShotStatus: (projectId: string, status: ShotListStatus, error?: string) => void;
  setBatchProgress: (projectId: string, progress: BatchProgress | null) => void;
  setMappings: (projectId: string, mappings: { characterIdMap?: Record<string, string>; sceneIdMap?: Record<string, string> }) => void;
  resetProjectData: (projectId: string) => void;
  // Episode CRUD
  addEpisode: (projectId: string, episode: Episode) => void;
  updateEpisode: (projectId: string, episodeId: string, updates: Partial<Episode>) => void;
  deleteEpisode: (projectId: string, episodeId: string) => void;
  // Scene CRUD
  addScene: (projectId: string, scene: ScriptScene, episodeId?: string) => void;
  updateScene: (projectId: string, sceneId: string, updates: Partial<ScriptScene>) => void;
  deleteScene: (projectId: string, sceneId: string) => void;
  // Character CRUD
  addCharacter: (projectId: string, character: ScriptCharacter) => void;
  updateCharacter: (projectId: string, characterId: string, updates: Partial<ScriptCharacter>) => void;
  deleteCharacter: (projectId: string, characterId: string) => void;
  // Shot CRUD
  addShot: (projectId: string, shot: Shot) => void;
  deleteShot: (projectId: string, shotId: string) => void;
  // 完整剧本管理
  setProjectBackground: (projectId: string, background: ProjectBackground) => void;
  setEpisodeRawScripts: (projectId: string, scripts: EpisodeRawScript[]) => void;
  updateEpisodeRawScript: (projectId: string, episodeIndex: number, updates: Partial<EpisodeRawScript>) => void;
  setMetadataMarkdown: (projectId: string, markdown: string) => void;
}

type ScriptStore = ScriptStoreState & ScriptStoreActions;

const defaultProjectData = (): ScriptProjectData => ({
  rawScript: "",
  language: "中文",
  targetDuration: "60s",
  styleId: "2d_ghibli",
  sceneCount: undefined,
  shotCount: undefined,
  scriptData: null,
  parseStatus: "idle",
  parseError: undefined,
  shots: [],
  shotStatus: "idle",
  shotError: undefined,
  batchProgress: null,
  characterIdMap: {},
  sceneIdMap: {},
  updatedAt: Date.now(),
  // 新增默认值
  projectBackground: null,
  episodeRawScripts: [],
  metadataMarkdown: '',
  metadataGeneratedAt: undefined,
});

export const useScriptStore = create<ScriptStore>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      projects: {},

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      ensureProject: (projectId) => {
        const { projects } = get();
        if (projects[projectId]) return;
        set({
          projects: { ...projects, [projectId]: defaultProjectData() },
        });
      },

      setRawScript: (projectId, rawScript) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              rawScript,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setLanguage: (projectId, language) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              language,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setTargetDuration: (projectId, duration) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              targetDuration: duration,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setStyleId: (projectId, styleId) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              styleId,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setSceneCount: (projectId, sceneCount) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              sceneCount,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setShotCount: (projectId, shotCount) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              shotCount,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setScriptData: (projectId, data) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              scriptData: data,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setParseStatus: (projectId, status, error) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              parseStatus: status,
              parseError: error,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setShots: (projectId, shots) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              shots,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      updateShot: (projectId, shotId, updates) => {
        get().ensureProject(projectId);
        set((state) => {
          const prevShot = state.projects[projectId]?.shots.find((s) => s.id === shotId);
          const nextProjects = {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              shots: state.projects[projectId].shots.map((s) =>
                s.id === shotId ? { ...s, ...updates } : s
              ),
              updatedAt: Date.now(),
            },
          };

          if (prevShot) {
            // Log only on status transitions / error changes (avoid spamming progress updates)
            if (updates.imageStatus && updates.imageStatus !== prevShot.imageStatus) {
              useRenderLogStore.getState().append(projectId, {
                level: updates.imageStatus === "completed" ? "success" : updates.imageStatus === "failed" ? "error" : "info",
                source: "script",
                kind: "image",
                entityId: shotId,
                label: `分镜 ${String(prevShot.index).padStart(3, "0")}`,
                status: updates.imageStatus,
                message: `图片${updates.imageStatus === "generating" ? "生成中" : updates.imageStatus === "completed" ? "已完成" : updates.imageStatus === "failed" ? "失败" : "待生成"}`,
                error: (updates as any).imageError,
                url: (updates as any).imageUrl,
              });
            }
            if (updates.videoStatus && updates.videoStatus !== prevShot.videoStatus) {
              useRenderLogStore.getState().append(projectId, {
                level: updates.videoStatus === "completed" ? "success" : updates.videoStatus === "failed" ? "error" : "info",
                source: "script",
                kind: "video",
                entityId: shotId,
                label: `分镜 ${String(prevShot.index).padStart(3, "0")}`,
                status: updates.videoStatus,
                message: `视频${updates.videoStatus === "generating" ? "生成中" : updates.videoStatus === "completed" ? "已完成" : updates.videoStatus === "failed" ? "失败" : "待生成"}`,
                error: (updates as any).videoError,
                url: (updates as any).videoUrl,
              });
            }
            if ((updates as any).imageError && (updates as any).imageError !== (prevShot as any).imageError) {
              useRenderLogStore.getState().append(projectId, {
                level: "error",
                source: "script",
                kind: "image",
                entityId: shotId,
                label: `分镜 ${String(prevShot.index).padStart(3, "0")}`,
                status: String((updates as any).imageStatus ?? prevShot.imageStatus),
                message: "图片错误更新",
                error: (updates as any).imageError,
              });
            }
            if ((updates as any).videoError && (updates as any).videoError !== (prevShot as any).videoError) {
              useRenderLogStore.getState().append(projectId, {
                level: "error",
                source: "script",
                kind: "video",
                entityId: shotId,
                label: `分镜 ${String(prevShot.index).padStart(3, "0")}`,
                status: String((updates as any).videoStatus ?? prevShot.videoStatus),
                message: "视频错误更新",
                error: (updates as any).videoError,
              });
            }
          }

          return { projects: nextProjects };
        });
      },

      setShotStatus: (projectId, status, error) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              shotStatus: status,
              shotError: error,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setBatchProgress: (projectId, progress) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              batchProgress: progress,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setMappings: (projectId, mappings) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              characterIdMap: mappings.characterIdMap || state.projects[projectId].characterIdMap,
              sceneIdMap: mappings.sceneIdMap || state.projects[projectId].sceneIdMap,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      resetProjectData: (projectId) => {
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: defaultProjectData(),
          },
        }));
      },

      // Episode CRUD
      addEpisode: (projectId, episode) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  episodes: [...(project.scriptData.episodes || []), episode],
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateEpisode: (projectId, episodeId, updates) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  episodes: (project.scriptData.episodes || []).map((e) =>
                    e.id === episodeId ? { ...e, ...updates } : e
                  ),
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteEpisode: (projectId, episodeId) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          // Also remove scenes belonging to this episode
          const episode = project.scriptData.episodes?.find((e) => e.id === episodeId);
          const sceneIdsToRemove = new Set(episode?.sceneIds || []);
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  episodes: (project.scriptData.episodes || []).filter((e) => e.id !== episodeId),
                  scenes: project.scriptData.scenes.filter((s) => !sceneIdsToRemove.has(s.id)),
                },
                shots: project.shots.filter((s) => !sceneIdsToRemove.has(s.sceneRefId)),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // Scene CRUD
      addScene: (projectId, scene, episodeId) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          const newScenes = [...project.scriptData.scenes, scene];
          let newEpisodes = project.scriptData.episodes || [];
          if (episodeId) {
            newEpisodes = newEpisodes.map((e) =>
              e.id === episodeId ? { ...e, sceneIds: [...e.sceneIds, scene.id] } : e
            );
          } else if (newEpisodes.length > 0) {
            // Add to first episode if no specific episode specified
            newEpisodes = newEpisodes.map((e, i) =>
              i === 0 ? { ...e, sceneIds: [...e.sceneIds, scene.id] } : e
            );
          }
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  scenes: newScenes,
                  episodes: newEpisodes,
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateScene: (projectId, sceneId, updates) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  scenes: project.scriptData.scenes.map((s) =>
                    s.id === sceneId ? { ...s, ...updates } : s
                  ),
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteScene: (projectId, sceneId) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  scenes: project.scriptData.scenes.filter((s) => s.id !== sceneId),
                  episodes: (project.scriptData.episodes || []).map((e) => ({
                    ...e,
                    sceneIds: e.sceneIds.filter((id) => id !== sceneId),
                  })),
                },
                shots: project.shots.filter((s) => s.sceneRefId !== sceneId),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // Character CRUD
      addCharacter: (projectId, character) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  characters: [...project.scriptData.characters, character],
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateCharacter: (projectId, characterId, updates) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  characters: project.scriptData.characters.map((c) =>
                    c.id === characterId ? { ...c, ...updates } : c
                  ),
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteCharacter: (projectId, characterId) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          if (!project.scriptData) return state;
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                scriptData: {
                  ...project.scriptData,
                  characters: project.scriptData.characters.filter((c) => c.id !== characterId),
                },
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // Shot CRUD
      addShot: (projectId, shot) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                shots: [...project.shots, shot],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      deleteShot: (projectId, shotId) => {
        get().ensureProject(projectId);
        set((state) => {
          const project = state.projects[projectId];
          return {
            projects: {
              ...state.projects,
              [projectId]: {
                ...project,
                shots: project.shots.filter((s) => s.id !== shotId),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      // 完整剧本管理方法
      setProjectBackground: (projectId, background) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              projectBackground: background,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setEpisodeRawScripts: (projectId, scripts) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              episodeRawScripts: scripts,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      updateEpisodeRawScript: (projectId, episodeIndex, updates) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              episodeRawScripts: state.projects[projectId].episodeRawScripts.map((ep) =>
                ep.episodeIndex === episodeIndex ? { ...ep, ...updates } : ep
              ),
              updatedAt: Date.now(),
            },
          },
        }));
      },

      setMetadataMarkdown: (projectId, markdown) => {
        get().ensureProject(projectId);
        set((state) => ({
          projects: {
            ...state.projects,
            [projectId]: {
              ...state.projects[projectId],
              metadataMarkdown: markdown,
              metadataGeneratedAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        }));
      },
    }),
    {
      name: "moyin-script-store",
      storage: createJSONStorage(() => createProjectScopedStorage('script')),
      partialize: (state) => {
        const pid = state.activeProjectId;
        if (!pid || !state.projects[pid]) return { activeProjectId: pid };
        return {
          activeProjectId: pid,
          projectData: state.projects[pid],
        };
      },
      merge: (persisted: any, current: any) => {
        if (!persisted) return current;
        
        // Legacy format: has `projects` as Record (from old monolithic file)
        if (persisted.projects && typeof persisted.projects === 'object') {
          return { ...current, ...persisted };
        }
        
        // New per-project format: has `projectData` for single project
        const { activeProjectId: pid, projectData } = persisted;
        if (!pid || !projectData) return current;
        
        return {
          ...current,
          activeProjectId: pid,
          projects: { ...current.projects, [pid]: projectData },
        };
      },
    }
  )
);

export const useActiveScriptProject = (): ScriptProjectData | null => {
  return useScriptStore((state) => {
    const id = state.activeProjectId;
    if (!id) return null;
    return state.projects[id] || null;
  });
};
