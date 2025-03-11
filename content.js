(() => {
  if (!window.location.href.includes("linkedin.com/sales")) {
    return;
  }

  function getCurrentUTCDate() {
    const now = new Date();
    return now.getUTCFullYear() + '-' + 
           String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
           String(now.getUTCDate()).padStart(2, '0') + ' ' +
           String(now.getUTCHours()).padStart(2, '0') + ':' +
           String(now.getUTCMinutes()).padStart(2, '0') + ':' +
           String(now.getUTCSeconds()).padStart(2, '0');
  }

  function findSelectedConversation() {
    const activeConversationSelectors = [
      ".msg-conversation-listitem--selected",
      ".msg-conversation-card--selected",
      ".artdeco-tab.active",
      "[aria-selected='true']",
      ".msg-thread[data-selected='true']"
    ];

    for (const selector of activeConversationSelectors) {
      const selected = document.querySelector(selector);
      if (selected && selected.offsetHeight > 0) {
        return selected;
      }
    }

    if (window.location.href.includes("/messaging/thread/")) {
      return document.querySelector(".msg-conversation-container");
    }

    const selectedConversationIndicators = [
      ".selected",
      ".active",
      ".msg-conversation-listitem--selected",
      ".msg-conversation-card--selected",
      ".conversation-item--selected",
      ".msg-conversation-listitem.active",
      "[aria-selected='true']",
      ".msg-thread[data-selected='true']",
      ".artdeco-tab.active",
      ".artdeco-tab--selected",
      ".active-conversation-card"
    ];

    for (const selector of selectedConversationIndicators) {
      const selected = document.querySelector(selector);
      if (selected && selected.offsetHeight > 0) {
        console.log("Conversación seleccionada encontrada por selector:", selector, selected);
        return selected;
      }
    }

    if (window.location.href.includes("/messaging/") || window.location.href.includes("/inbox/")) {
      const messagePanel = 
        document.querySelector(".msg-conversations-container__conversations-list") ||
        document.querySelector(".msg-overlay-conversation-bubble--is-active");

      if (messagePanel) {
        const conversations = messagePanel.querySelectorAll(
          ".msg-conversation-listitem, .message-thread, .conversation-item"
        );

        for (const conversation of conversations) {
          const computedStyle = window.getComputedStyle(conversation);
          const hasBorder = 
            computedStyle.border !== "0px none rgb(0, 0, 0)" &&
            computedStyle.border !== "" &&
            computedStyle.border !== "none";
          const hasBackground = 
            computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && 
            computedStyle.backgroundColor !== "transparent";

          if (conversation.matches(":focus") || conversation.querySelector(":focus") || hasBorder || hasBackground) {
            console.log("Conversación con foco o selección visual encontrada:", conversation);
            return conversation;
          }
        }

        for (const conversation of conversations) {
          if (conversation.offsetHeight > 0 && isElementInViewport(conversation)) {
            console.log("Usando primera conversación visible en el panel:", conversation);
            return conversation;
          }
        }
      }
    }

    if (window.location.href.includes("/sales/lead/") || window.location.href.includes("/sales/company/")) {
      console.log("Detectada página de perfil de lead/cuenta");

      const profileContainer = 
        document.querySelector(".profile-topcard") ||
        document.querySelector(".artdeco-entity-lockup") ||
        document.querySelector("[data-lead-id]") ||
        document.querySelector("[data-account-id]");

      if (profileContainer) {
        console.log("Usando container de perfil de lead/cuenta:", profileContainer);
        return profileContainer;
      }
    }

    console.log("No se encontró conversación seleccionada específica");
    return null;
  }

  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  async function extractConversationData(container) {
    const contactName = findContactName(container);
    const contactTitle = findContactTitle(container);
    const messages = extractMessages(container);
    const lastMessage = messages.length > 0 ? messages[messages.length - 1].text : null;

    return {
      contactName,
      contactTitle,
      messages,
      lastMessage,
      totalMessages: messages.length,
      url: window.location.href
    };
  }

  function findContactName(container) {
    const nameSelectors = [
      ".msg-conversation-card__participant-names",
      ".profile-info-card__participant-name",
      ".artdeco-entity-lockup__title",
      ".conversation-header__name",
      ".messaging-thread-header__name",
      ".msg-thread__participant-names",
      ".profile-info-card__name"
    ];

    for (const selector of nameSelectors) {
      const element = container.querySelector(selector) || document.querySelector(selector);
      if (element) {
        const name = element.textContent.trim();
        if (name && !name.includes("LinkedIn")) {
          return name;
        }
      }
    }
    return "Desconocido";
  }

  function findContactTitle(container) {
    const titleSelectors = [
      ".msg-conversation-card__participant-occupations",
      ".profile-info-card__participant-headline",
      ".artdeco-entity-lockup__subtitle",
      ".profile-info__occupation",
      ".conversation-header__status"
    ];

    for (const selector of titleSelectors) {
      const element = container.querySelector(selector) || document.querySelector(selector);
      if (element) {
        const title = element.textContent.trim();
        if (title && title.length > 3) {
          return title;
        }
      }
    }
    return "";
  }

  function extractMessages(container) {
    const messages = [];
    const messageElements = container.querySelectorAll(`
      .msg-s-event-listitem__body,
      .msg-s-message-group__msg,
      .message-thread__message,
      .message-item,
      .conversation-message
    `);

    messageElements.forEach(msgElement => {
      if (msgElement.offsetHeight > 0) {
        const isOutgoing = msgElement.closest(".msg-s-message-group--outgoing") ||
                          msgElement.classList.contains("outgoing");
        const text = msgElement.textContent.trim();

        if (text && !messages.some(m => m.text === text)) {
          messages.push({
            sender: isOutgoing ? "RamiMata" : findContactName(container),
            text,
            timestamp: getCurrentUTCDate(),
            isMe: isOutgoing
          });
        }
      }
    });

    return messages;
  }

  function copyToClipboard(text) {
    if (!text) {
      console.warn("No hay texto para copiar");
      return;
    }

    try {
      navigator.clipboard.writeText(text).then(
        () => {
          console.log("Texto copiado al portapapeles:", text);
          showNotification("✅ Mensaje copiado al portapapeles");
        },
        (err) => {
          console.error("Error al copiar usando API:", err);
          // Fallback método
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          try {
            const successful = document.execCommand("copy");
            if (successful) {
              console.log("Texto copiado (método alternativo):", text);
              showNotification("✅ Mensaje copiado al portapapeles");
            } else {
              throw new Error("No se pudo copiar el texto");
            }
          } catch (err) {
            console.error("Error en fallback de clipboard:", err);
            showNotification("❌ No se pudo copiar el mensaje");
          } finally {
            document.body.removeChild(textarea);
          }
        }
      );
    } catch (error) {
      console.error("Error al copiar al portapapeles:", error);
      showNotification("❌ Error al copiar el mensaje");
    }
  }

  async function handleDataExtraction() {
    const button = document.querySelector("button");
    button.innerHTML = "⏱️ Procesando...";
    button.disabled = true;
    button.style.opacity = "0.7";
    button.style.cursor = "wait";

    try {
      const selectedConversation = findSelectedConversation();
      
      if (!selectedConversation) {
        throw new Error("Por favor, selecciona una conversación primero");
      }

      const data = await extractConversationData(selectedConversation);
      
      // Agregar fecha UTC y usuario
      const formattedData = {
        ...data,
        userLogin: "RamiMata",
        extractionTime: getCurrentUTCDate()
      };
      
      console.log("Datos extraídos:", formattedData);

      const response = await fetch("https://hook.us2.make.com/0tdpujb14unoorvrtu7gp3nauqatp3jf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        throw new Error(`Error al enviar datos: ${response.status}`);
      }

      // Leer la respuesta una sola vez
      const responseText = await response.text();
      let responseData;

      try {
        // Intentar parsear como JSON
        responseData = JSON.parse(responseText);
        if (responseData && responseData.reply) {
          showNotification("✅ Mensaje copiado al portapapeles");
          copyToClipboard(responseData.reply);
        } else {
          // Si hay respuesta pero no tiene reply, copiar la respuesta completa
          showNotification("✅ Mensaje copiado al portapapeles");
          copyToClipboard(responseText);
        }
      } catch (jsonError) {
        // Si no es JSON, usar el texto directamente
        console.warn("La respuesta no es JSON, usando texto plano");
        if (responseText) {
          showNotification("✅ Mensaje copiado al portapapeles");
          copyToClipboard(responseText);
        } else {
          showNotification("✅ Datos enviados correctamente");
        }
      }

    } catch (error) {
      console.error("Error:", error);
      showNotification("❌ " + error.message);
    } finally {
      button.innerHTML = "Settear";
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
    }
}
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #333;
      color: white;
      border-radius: 5px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  // Crear botón
  const button = document.createElement("button");
  button.innerHTML = "Settear";
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #0a66c2;
    color: white;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    z-index: 9999;
    font-family: Arial, sans-serif;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    transition: background-color 0.3s;
  `;
  button.onmouseover = () => button.style.backgroundColor = '#004182';
  button.onmouseout = () => button.style.backgroundColor = '#0a66c2';
  button.onclick = handleDataExtraction;
  document.body.appendChild(button);
})();