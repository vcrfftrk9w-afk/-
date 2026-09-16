import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Niche } from "@/lib/niches";
import { analyzeProfile, ProfileStats } from "@/lib/analysis";
import { analyzeRealProfile, RealProfileInput } from "@/lib/realAnalysis";
import { VideoIdea } from "@/lib/ideas";

interface AppState {
  username: string;
  niche: Niche | null;
  connected: boolean;
  profile: ProfileStats | null;
  lastRealInput: RealProfileInput | null;
  completedTasks: string[];
  savedIdeas: VideoIdea[];
  ideaVariantSeed: number;

  connect: (username: string, niche: Niche) => void;
  connectReal: (input: RealProfileInput) => void;
  disconnect: () => void;
  toggleTask: (taskId: string) => void;
  saveIdea: (idea: VideoIdea) => void;
  removeIdea: (id: string) => void;
  reshuffleIdeas: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      username: "",
      niche: null,
      connected: false,
      profile: null,
      lastRealInput: null,
      completedTasks: [],
      savedIdeas: [],
      ideaVariantSeed: 0,

      connect: (username, niche) => {
        const profile = analyzeProfile(username, niche);
        set({
          username: profile.username,
          niche,
          connected: true,
          profile,
        });
      },

      connectReal: (input) => {
        const profile = analyzeRealProfile(input);
        set({
          username: profile.username,
          niche: input.niche,
          connected: true,
          profile,
          lastRealInput: input,
        });
      },

      disconnect: () =>
        set({
          username: "",
          niche: null,
          connected: false,
          profile: null,
          lastRealInput: null,
          completedTasks: [],
          savedIdeas: [],
          ideaVariantSeed: 0,
        }),

      toggleTask: (taskId) => {
        const { completedTasks } = get();
        const exists = completedTasks.includes(taskId);
        set({
          completedTasks: exists
            ? completedTasks.filter((t) => t !== taskId)
            : [...completedTasks, taskId],
        });
      },

      saveIdea: (idea) => {
        const { savedIdeas } = get();
        if (savedIdeas.some((i) => i.id === idea.id)) return;
        set({ savedIdeas: [idea, ...savedIdeas].slice(0, 30) });
      },

      removeIdea: (id) => {
        set({ savedIdeas: get().savedIdeas.filter((i) => i.id !== id) });
      },

      reshuffleIdeas: () => set({ ideaVariantSeed: get().ideaVariantSeed + 1 }),
    }),
    {
      name: "viral-coach-storage",
    },
  ),
);
