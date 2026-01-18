import { ChatProvider, useChatContext } from "./ChatContext";
import { ModelProvider, useModelContext } from "./ModelContext";
import { UIProvider, useUIContext } from "./UIContext";
import { NotificationProvider, useNotificationContext } from "./NotificationContext";
import { ModalProvider, useModalContext, MODAL_NAMES } from "./ModalContext";

export { ChatProvider, useChatContext };
export { ModelProvider, useModelContext };
export { UIProvider, useUIContext };
export { NotificationProvider, useNotificationContext };
export { ModalProvider, useModalContext, MODAL_NAMES };

export function AppProviders({ children }: { children: preact.ComponentChildren }) {
  return (
    <NotificationProvider>
      <UIProvider>
        <ModelProvider>
          <ChatProvider>
            <ModalProvider>{children}</ModalProvider>
          </ChatProvider>
        </ModelProvider>
      </UIProvider>
    </NotificationProvider>
  );
}
