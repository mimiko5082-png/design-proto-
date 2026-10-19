function encode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const status = document.getElementById("status");
document.getElementById("generate").addEventListener("click", async event => {
  event.currentTarget.disabled = true;
  try {
    const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    document.getElementById("public").value = encode(await crypto.subtle.exportKey("raw", keys.publicKey));
    document.getElementById("private").value = encode(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
    document.getElementById("keys").hidden = false;
    status.textContent = "作成しました。公開鍵と秘密鍵を、それぞれCloudflareに登録してください。";
  } catch { status.textContent = "鍵を作成できませんでした。HTTPSの対応ブラウザで再度お試しください。"; }
});
for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).value);
      status.textContent = (button.dataset.copy === "private" ? "秘密鍵" : "公開鍵") + "をコピーしました。Cloudflareの対応する設定欄へ貼り付けてください。";
    } catch { status.textContent = "コピーできませんでした。ブラウザのクリップボード設定を確認してください。"; }
  });
}
