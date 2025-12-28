import { toast } from "sonner";

export const notify = {
  success: (message: string, description?: string) => {
    toast.success(message, { description });
  },
  
  error: (message: string, description?: string) => {
    toast.error(message, { description });
  },
  
  info: (message: string, description?: string) => {
    toast.info(message, { description });
  },
  
  warning: (message: string, description?: string) => {
    toast.warning(message, { description });
  },

  loading: (message: string) => {
    return toast.loading(message);
  },

  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },

  styleCreated: (styleName: string) => {
    toast.success("Style created", {
      description: `"${styleName}" is now in your vault`,
    });
  },

  styleDeleted: (styleName: string) => {
    toast.success("Style deleted", {
      description: `"${styleName}" has been removed`,
    });
  },

  styleSaved: () => {
    toast.success("Style saved to your library");
  },

  styleUnsaved: () => {
    toast.success("Style removed from your library");
  },

  exportSuccess: (format: string) => {
    toast.success("Export complete", {
      description: `Tokens exported as ${format}`,
    });
  },

  exportError: () => {
    toast.error("Export failed", {
      description: "Please try again or contact support",
    });
  },

  copySuccess: (what = "Content") => {
    toast.success(`${what} copied to clipboard`);
  },

  copyError: () => {
    toast.error("Failed to copy to clipboard");
  },

  networkError: () => {
    toast.error("Connection error", {
      description: "Please check your network and try again",
    });
  },

  rateLimited: () => {
    toast.warning("Slow down", {
      description: "You're making too many requests. Please wait a moment.",
    });
  },

  generationStarted: () => {
    toast.info("Generation started", {
      description: "This may take a few moments...",
    });
  },

  generationComplete: () => {
    toast.success("Generation complete", {
      description: "Your new assets are ready",
    });
  },

  generationFailed: () => {
    toast.error("Generation failed", {
      description: "Please try again with different parameters",
    });
  },

  collectionCreated: (name: string) => {
    toast.success("Collection created", {
      description: `"${name}" is ready for your styles`,
    });
  },

  collectionDeleted: () => {
    toast.success("Collection deleted");
  },

  ratingSubmitted: (rating: number) => {
    toast.success(`Rated ${rating} stars`);
  },

  shareLink: () => {
    toast.success("Share link copied", {
      description: "Anyone with the link can view this style",
    });
  },
};
