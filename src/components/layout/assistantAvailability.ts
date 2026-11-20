'use client';
import { createContext, useContext } from 'react';

/** True only inside an enabled assistant drawer; surfaces hide their "Ask DeepVisor" entry points otherwise. */
export const AssistantAvailableContext = createContext(false);
export const useAssistantAvailable = () => useContext(AssistantAvailableContext);
