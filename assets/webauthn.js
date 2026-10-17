/* Adaptateur WebAuthn natif : les données biométriques restent sur l'appareil. */
(function () {
"use strict";
function fromBase64url(value) {
  var base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  var binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function toBase64url(buffer) {
  var bytes = new Uint8Array(buffer), binary = "";
  for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function publicKeyOptions(options) {
  var copy = Object.assign({}, options, { challenge: fromBase64url(options.challenge) });
  if (options.user) copy.user = Object.assign({}, options.user, { id: fromBase64url(options.user.id) });
  ["allowCredentials", "excludeCredentials"].forEach(function (key) {
    if (options[key]) copy[key] = options[key].map(function (entry) { return Object.assign({}, entry, { id: fromBase64url(entry.id) }); });
  });
  return copy;
}
function serialise(credential, registration) {
  var response = credential.response, data = {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults()
  };
  if (registration) {
    data.response = {
      clientDataJSON: toBase64url(response.clientDataJSON),
      attestationObject: toBase64url(response.attestationObject),
      transports: response.getTransports ? response.getTransports() : []
    };
  } else {
    data.response = {
      clientDataJSON: toBase64url(response.clientDataJSON),
      authenticatorData: toBase64url(response.authenticatorData),
      signature: toBase64url(response.signature),
      userHandle: response.userHandle ? toBase64url(response.userHandle) : null
    };
  }
  return data;
}
function ensureSupport() {
  if (!window.isSecureContext || !navigator.credentials || !window.PublicKeyCredential) {
    throw new Error("La vérification biométrique requiert un navigateur compatible sur localhost ou HTTPS.");
  }
}
window.MIWebAuthn = {
  register: async function (options) {
    ensureSupport();
    var credential = await navigator.credentials.create({ publicKey: publicKeyOptions(options) });
    if (!credential) throw new Error("Aucune clé biométrique n'a été créée.");
    return serialise(credential, true);
  },
  authenticate: async function (options) {
    ensureSupport();
    var credential = await navigator.credentials.get({ publicKey: publicKeyOptions(options) });
    if (!credential) throw new Error("La vérification biométrique a été annulée.");
    return serialise(credential, false);
  }
};
})();
