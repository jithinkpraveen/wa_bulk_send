export const PROCESSING_LIMIT = 1000
export const PARALLEL_BATCH_COUNT = 3
export const PARALLEL_SEND_MESSAGE_COUNT = 50

// Graph API version used for every WhatsApp Cloud API call. Single source of
// truth so it can be bumped in one place. v25.0 is the current stable release;
// the template send contract is unchanged across v23–v25.
export const WHATSAPP_API_VERSION = 'v25.0'
