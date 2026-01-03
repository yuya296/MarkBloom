"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRenderDocumentMessage = isRenderDocumentMessage;
function isRenderDocumentMessage(message) {
    const candidate = message;
    return candidate?.type === 'renderDocument' && typeof candidate?.payload?.markdown === 'string';
}
