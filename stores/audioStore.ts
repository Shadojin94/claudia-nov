import { create } from 'zustand';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface AudioState {
  isListening: boolean;
  isAISpeaking: boolean;
  isActiveMode: boolean;
  isAgentMode: boolean;
  aiResponse: string;
  sessionStartTime: number | null;
  currentThread: string | null;
  showDownloadModal: boolean;

  startListening: () => void;
  stopListening: () => void;
  toggleActiveMode: () => void;
  setAIResponse: (response: string) => void;
  handleImageUpload: (file: File) => Promise<void>;
  handleFileUpload: (file: File) => Promise<void>;
  startAgentChat: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  sendMessageToAgent: (message: string) => Promise<void>;
  toggleDownloadModal: () => void;
  addToAudioQueue: (text: string) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isListening: false,
  isAISpeaking: false,
  isActiveMode: false,
  isAgentMode: false,
  aiResponse: '',
  sessionStartTime: null,
  currentThread: null,
  showDownloadModal: false,

  startListening: () => {
    if (!get().sessionStartTime) {
      set({ sessionStartTime: Date.now() });
    }
    set({ isListening: true });
  },

  stopListening: () => set({ isListening: false }),

  toggleActiveMode: () => set(state => ({ isActiveMode: !state.isActiveMode })),

  setAIResponse: (response: string) => set({ aiResponse: response }),

  handleImageUpload: async (file: File) => {
    try {
      const base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Décris cette image en détail en français. Sois naturel et précis."
              },
              {
                type: "image_url",
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ]
      });

      const description = response.choices[0].message.content;
      set({ aiResponse: description });
      get().addToAudioQueue(description);
    } catch (error) {
      console.error('Error processing image:', error);
      set({ aiResponse: "Désolé, une erreur est survenue lors de l'analyse de l'image." });
    }
  },

  handleFileUpload: async (file: File) => {
    if (!get().isAgentMode) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'assistants');

      const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Erreur lors du téléchargement du fichier');
      }

      const uploadData = await uploadResponse.json();
      const fileId = uploadData.id;

      if (!get().currentThread) {
        await get().startAgentChat();
      }

      if (get().currentThread) {
        await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            role: "user",
            content: "J'ai téléchargé un fichier. Pouvez-vous m'aider à l'analyser ?",
            file_ids: [fileId]
          })
        });

        await get().sendMessageToAgent("");
      }
    } catch (error) {
      console.error('Error processing file:', error);
      set({ aiResponse: "Désolé, une erreur est survenue lors du traitement du fichier." });
    }
  },

  startAgentChat: async () => {
    try {
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!threadResponse.ok) {
        throw new Error('Erreur lors de la création du thread');
      }

      const thread = await threadResponse.json();
      set({ 
        currentThread: thread.id,
        isAgentMode: true,
        aiResponse: "Bonjour, je suis votre agent assistant. Comment puis-je vous aider ?"
      });
    } catch (error) {
      console.error('Error starting agent chat:', error);
      set({ aiResponse: "Désolé, une erreur est survenue lors de la connexion avec l'agent." });
    }
  },

  sendMessage: async (message: string) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: message }]
      });

      const reply = response.choices[0].message.content;
      set({ aiResponse: reply });
      get().addToAudioQueue(reply);
    } catch (error) {
      console.error('Error sending message:', error);
      set({ aiResponse: "Désolé, une erreur est survenue lors de l'envoi du message." });
    }
  },

  sendMessageToAgent: async (message: string) => {
    if (!get().currentThread) return;

    try {
      await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: "user",
          content: message
        })
      });

      const runResponse = await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: "asst_JaH2MRCLxltrsI34qa7gQ5RP"
        })
      });

      if (!runResponse.ok) {
        throw new Error('Erreur lors de l\'exécution de l\'assistant');
      }

      const run = await runResponse.json();
      let runStatus = await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      let runData = await runStatus.json();

      while (runData.status === 'in_progress' || runData.status === 'queued') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/runs/${run.id}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        runData = await runStatus.json();
      }

      if (runData.status === 'completed') {
        const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${get().currentThread}/messages`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });

        const messages = await messagesResponse.json();
        const lastMessage = messages.data[0];
        const reply = lastMessage.content[0].text.value;
        
        set({ aiResponse: reply });
        get().addToAudioQueue(reply);
      }
    } catch (error) {
      console.error('Error sending message to agent:', error);
      set({ aiResponse: "Désolé, une erreur est survenue lors de la communication avec l'agent." });
    }
  },

  toggleDownloadModal: () => set(state => ({ showDownloadModal: !state.showDownloadModal })),

  addToAudioQueue: async (text: string) => {
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "nova"
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      set({ isAISpeaking: true });
      
      audio.onended = () => {
        set({ isAISpeaking: false });
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      set({ isAISpeaking: false });
    }
  }
}));