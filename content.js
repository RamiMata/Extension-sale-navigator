// Función principal que se ejecuta cuando el script de contenido se carga
;(() => {
  // Verificar si estamos en la página de Sales Navigator de LinkedIn
  if (!window.location.href.includes("linkedin.com/sales")) {
    return
  }

  let buttonCreated = false

  // Crear el botón "Settear"
  function createSetButton() {
    // Verificar si el botón ya existe
    if (document.getElementById("linkedin-assistant-button")) {
      return
    }

    // Crear el botón
    const button = document.createElement("button")
    button.id = "linkedin-assistant-button"
    button.className = "linkedin-assistant-button"
    button.innerHTML = "Settear"

    // Agregar el evento click al botón
    button.addEventListener("click", handleButtonClick)

    // Insertar como elemento fijo
    const buttonContainer = document.createElement("div")
    buttonContainer.className = "linkedin-assistant-container linkedin-assistant-container-fixed"
    buttonContainer.appendChild(button)
    document.body.appendChild(buttonContainer)
    buttonCreated = true
  }

  // Manejar el clic en el botón
  async function handleButtonClick() {
    const button = document.getElementById("linkedin-assistant-button")
    button.innerHTML = "⏱️ Procesando..."
    button.disabled = true
    button.classList.add("processing")

    try {
      console.log("Iniciando extracción de datos...")

      // ESTRATEGIA 1: Intentar extraer datos de la conversación seleccionada
      let container = findSelectedConversation()
      let data = null
      let forcedExtraction = false

      if (container) {
        console.log("Encontrada conversación seleccionada, extrayendo datos específicos...")
        data = await extractConversationData(container, false)
      }

      // ESTRATEGIA 2: Si no hay datos suficientes, realizar extracción forzada
      if (
        !data ||
        !data.contactName ||
        data.contactName === "Desconocido" ||
        data.messages.length === 0 ||
        data.messages[0].sender === "Sistema"
      ) {
        console.log("Datos insuficientes, realizando extracción forzada...")
        container = findAnyContentContainer()
        data = await extractConversationData(container, true)
        forcedExtraction = true
      }

      console.log("Datos extraídos:", data)

      // Asegurar que forcedExtraction esté establecido correctamente
      data.forcedExtraction = forcedExtraction

      // Enviar al webhook
      const response = await sendToWebhook(data)
      console.log("Respuesta del webhook:", response)

      button.innerHTML = "Settear"
      button.disabled = false
      button.classList.remove("processing")

      if (response && response.reply) {
        // Mostrar notificación como antes
        showNotification("✅ " + response.reply)

        // NUEVO: Copiar al portapapeles
        copyToClipboard(response.reply)

        // NUEVO: Insertar en el campo de mensaje si existe
        insertIntoMessageField(response.reply)
      } else {
        showNotification("✅ Datos enviados correctamente")
      }
    } catch (error) {
      console.error("Error:", error)
      button.innerHTML = "Settear"
      button.disabled = false
      button.classList.remove("processing")
      showNotification("❌ Error: " + error.message)
    }
  }

  // NUEVA FUNCIÓN: Copiar texto al portapapeles
  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text).then(
        () => {
          console.log("Texto copiado al portapapeles")
        },
        (err) => {
          console.error("No se pudo copiar el texto: ", err)
          // Fallback para navegadores que no soportan clipboard API
          const textarea = document.createElement("textarea")
          textarea.value = text
          textarea.style.position = "fixed"
          document.body.appendChild(textarea)
          textarea.focus()
          textarea.select()
          try {
            document.execCommand("copy")
            console.log("Texto copiado al portapapeles (método alternativo)")
          } catch (err) {
            console.error("Error en fallback de clipboard: ", err)
          }
          document.body.removeChild(textarea)
        },
      )
    } catch (error) {
      console.error("Error al copiar al portapapeles:", error)
    }
  }

  // NUEVA FUNCIÓN: Insertar texto en el campo de mensaje
  function insertIntoMessageField(text) {
    try {
      // Buscar campo de mensaje de LinkedIn
      const messageFields = document.querySelectorAll(
        ".msg-form__contenteditable, [contenteditable=true].compose-message, textarea.message-composer",
      )

      let inserted = false
      for (const field of messageFields) {
        if (field && field.offsetHeight > 0) {
          // Si es un elemento contenteditable
          if (field.getAttribute("contenteditable") === "true") {
            field.innerHTML = text
            field.dispatchEvent(new Event("input", { bubbles: true }))
          }
          // Si es un textarea
          else if (field.tagName === "TEXTAREA") {
            field.value = text
            field.dispatchEvent(new Event("input", { bubbles: true }))
          }

          console.log("Texto insertado en campo de mensaje")
          inserted = true
          break
        }
      }

      if (!inserted) {
        console.log("No se encontró un campo de mensaje para insertar el texto")
      }
    } catch (error) {
      console.error("Error al insertar texto en campo de mensaje:", error)
    }
  }

  // Función mejorada para encontrar la conversación actualmente seleccionada
  function findSelectedConversation() {
    console.log("Buscando conversación seleccionada...")

    // ENFOQUE 1: Verificar si estamos en una página de conversación individual
    if (
      window.location.href.includes("/messaging/thread/") ||
      window.location.href.includes("/messaging/compose/") ||
      window.location.href.includes("/inbox/thread/")
    ) {
      console.log("Detectada página de conversación individual")

      // Buscar el contenedor principal de la conversación activa
      const activeThreadContainer =
        document.querySelector(".msg-conversation-container") ||
        document.querySelector(".msg-thread") ||
        document.querySelector(".messaging-thread") ||
        document.querySelector(".active-conversation")

      if (activeThreadContainer) {
        console.log("Conversación individual encontrada:", activeThreadContainer)
        return activeThreadContainer
      }
    }

    // ENFOQUE 2: Buscar un elemento de conversación con clase 'active' o 'selected'
    const selectedConversationIndicators = [
      ".selected",
      ".active",
      ".msg-conversation-listitem--selected",
      ".msg-conversation-card--selected",
      ".conversation-item--selected",
      ".msg-conversation-listitem.active",
      "[aria-selected='true']",
      ".msg-thread[data-selected='true']",
      // Añadir más selectores específicos para Sales Navigator
      ".artdeco-tab.active",
      ".artdeco-tab--selected",
      ".active-conversation-card",
    ]

    for (const selector of selectedConversationIndicators) {
      const selected = document.querySelector(selector)
      if (selected && selected.offsetHeight > 0) {
        console.log("Conversación seleccionada encontrada por selector:", selector, selected)
        return selected
      }
    }

    // ENFOQUE 3: Buscar la conversación visible en el panel principal
    if (window.location.href.includes("/messaging/") || window.location.href.includes("/inbox/")) {
      const messagePanel =
        document.querySelector(".msg-conversations-container__conversations-list") ||
        document.querySelector(".msg-overlay-conversation-bubble--is-active")

      if (messagePanel) {
        // Buscar el primer elemento de conversación que tenga foco o esté marcado visualmente
        const conversations = messagePanel.querySelectorAll(
          ".msg-conversation-listitem, .message-thread, .conversation-item",
        )

        for (const conversation of conversations) {
          // Comprobar si tiene algún indicador visual de selección (borde, fondo diferente, etc.)
          const computedStyle = window.getComputedStyle(conversation)
          const hasBorder =
            computedStyle.border !== "0px none rgb(0, 0, 0)" &&
            computedStyle.border !== "" &&
            computedStyle.border !== "none"
          const hasBackground =
            computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && computedStyle.backgroundColor !== "transparent"

          if (conversation.matches(":focus") || conversation.querySelector(":focus") || hasBorder || hasBackground) {
            console.log("Conversación con foco o selección visual encontrada:", conversation)
            return conversation
          }
        }

        // Si no encontramos ninguna con focus o indicador visual, usar la primera visible
        for (const conversation of conversations) {
          if (conversation.offsetHeight > 0 && isElementInViewport(conversation)) {
            console.log("Usando primera conversación visible en el panel:", conversation)
            return conversation
          }
        }
      }
    }

    // ENFOQUE 4: Si estamos en una página de perfil de lead/cuenta, usar ese perfil
    if (window.location.href.includes("/sales/lead/") || window.location.href.includes("/sales/company/")) {
      console.log("Detectada página de perfil de lead/cuenta")

      const profileContainer =
        document.querySelector(".profile-topcard") ||
        document.querySelector(".artdeco-entity-lockup") ||
        document.querySelector("[data-lead-id]") ||
        document.querySelector("[data-account-id]")

      if (profileContainer) {
        console.log("Usando container de perfil de lead/cuenta:", profileContainer)
        return profileContainer
      }
    }

    console.log("No se encontró conversación seleccionada específica")
    return null
  }

  // Función para encontrar cualquier contenedor de contenido visible
  function findAnyContentContainer() {
    console.log("Buscando cualquier contenedor de contenido visible...")

    // ENFOQUE 1: Si estamos en una página de mensajes, usar cualquier elemento visible
    if (window.location.href.includes("/messaging/") || window.location.href.includes("/inbox/")) {
      console.log("Detectada página de mensajes, buscando cualquier contenido visible")

      // Usar el primer elemento de conversación visible en la lista
      const conversationItems = document.querySelectorAll(
        ".msg-conversation-listitem, .message-thread, .conversation-item",
      )
      for (const item of conversationItems) {
        if (item.offsetHeight > 0 && item.offsetWidth > 0) {
          console.log("Usando primer elemento de conversación visible:", item)
          return item
        }
      }

      // Si no hay elementos específicos, usar todo el contenedor de mensajes
      const messageContainer =
        document.querySelector(".msg-conversations-container") ||
        document.querySelector(".messages-container") ||
        document.querySelector(".inbox-container")
      if (messageContainer) {
        console.log("Usando contenedor completo de mensajes")
        return messageContainer
      }
    }

    // ENFOQUE 2: Si estamos en una página de perfil, usar el perfil
    if (window.location.href.includes("/in/") || window.location.href.includes("/sales/lead/")) {
      console.log("Detectada página de perfil, extrayendo datos de perfil")
      const profileContainer =
        document.querySelector(".pv-top-card") ||
        document.querySelector(".profile-topcard") ||
        document.querySelector(".profile-info") ||
        document.body // Último recurso: usar todo el body

      if (profileContainer) {
        console.log("Usando contenedor de perfil")
        return profileContainer
      }
    }

    // ENFOQUE 3: Último recurso - usar toda la página
    console.log("Forzando extracción usando toda la página")
    return document.body
  }

  // Función auxiliar para verificar si un elemento está visible en la ventana
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  // Función mejorada para extraer datos tanto de conversación seleccionada como forzada
  async function extractConversationData(conversationElement, isForcedExtraction) {
    console.log("Extrayendo datos:", isForcedExtraction ? "extracción forzada" : "conversación seleccionada")

    let contactName = "Desconocido"
    let contactTitle = ""
    const messages = []
    let lastReceivedMessage = ""
    let myProfileDescription = ""

    try {
      // PASO 1: Extraer datos del contacto con múltiples estrategias

      // MEJORA: Primero intentar obtener el nombre del contacto desde el encabezado de la conversación activa
      const activeConversationHeader =
        document.querySelector(".msg-conversation-card__participant-names") ||
        document.querySelector(".conversation-header__name") ||
        document.querySelector(".messaging-thread-header__name") ||
        document.querySelector(".msg-thread__participant-names")

      if (activeConversationHeader && activeConversationHeader.offsetHeight > 0) {
        contactName = activeConversationHeader.textContent.trim()
        console.log("Nombre extraído del encabezado de conversación activa:", contactName)
      }

      // Si no se encontró en el encabezado, buscar en el elemento seleccionado
      if (contactName === "Desconocido") {
        // Lista unificada de selectores para nombres
        const nameSelectors = [
          // Selectores específicos para Sales Navigator
          ".conversation-insights__name",
          ".profile-card-one-to-one__actor-name",
          ".profile-card__name",
          ".profile-card__actor-name",
          ".artdeco-entity-lockup__title",
          ".artdeco-entity-lockup__title-line",
          // Selecciones específicas para el chat/conversación activa
          ".msg-conversation-card__participant-names",
          ".message-thread__name",
          ".conversation-header__name",
          // Selecciones para perfil
          ".profile-topcard__title",
          ".profile-info__name",
          ".pv-top-card-section__name",
          ".text-heading-xlarge",
          // Selecciones genéricas, prioridad más baja
          "h1",
          "h2",
          "h3",
        ]

        // Estrategia 1: Buscar primero en el elemento proporcionado
        for (const selector of nameSelectors) {
          const nameElement = conversationElement.querySelector(selector)
          if (nameElement && nameElement.offsetHeight > 0 && nameElement.textContent.trim()) {
            const text = nameElement.textContent.trim()
            if (!text.includes("LinkedIn") && !text.includes("Mensaje") && !text.includes("Bandeja")) {
              contactName = text
              console.log("Nombre encontrado dentro del elemento:", contactName)
              break
            }
          }
        }
      }

      // Estrategia 2: Si aún no encontramos el nombre, buscar en todo el documento
      if (contactName === "Desconocido") {
        // MEJORA: Buscar específicamente en el panel de conversación activa
        const activeConversationPanel =
          document.querySelector(".msg-overlay-conversation-bubble--is-active") ||
          document.querySelector(".active-conversation-pane") ||
          document.querySelector(".messaging-thread--active")

        if (activeConversationPanel) {
          for (const selector of nameSelectors) {
            const nameElement = activeConversationPanel.querySelector(selector)
            if (nameElement && nameElement.offsetHeight > 0 && nameElement.textContent.trim()) {
              const text = nameElement.textContent.trim()
              if (!text.includes("LinkedIn") && !text.includes("Mensaje") && !text.includes("Bandeja")) {
                contactName = text
                console.log("Nombre encontrado en panel activo:", contactName)
                break
              }
            }
          }
        }

        // Si aún no lo encontramos, buscar en todo el documento
        if (contactName === "Desconocido") {
          for (const selector of nameSelectors) {
            const nameElements = document.querySelectorAll(selector)
            for (const elem of nameElements) {
              if (elem.offsetHeight > 0 && elem.textContent.trim()) {
                const text = elem.textContent.trim()
                if (!text.includes("LinkedIn") && !text.includes("Mensaje") && !text.includes("Bandeja")) {
                  contactName = text
                  console.log("Nombre encontrado en documento:", contactName)
                  break
                }
              }
            }
            if (contactName !== "Desconocido") break
          }
        }
      }

      // Lista unificada de selectores para títulos
      const titleSelectors = [
        // Selectores específicos para Sales Navigator
        ".profile-card-one-to-one__actor-headline",
        ".profile-card__headline",
        ".profile-card__actor-headline",
        ".artdeco-entity-lockup__subtitle",
        ".artdeco-entity-lockup__caption",
        // Selectores generales
        ".profile-topcard__subtitle",
        ".profile-info__occupation",
        ".pv-text-details__left-panel",
        ".text-body-medium",
        ".msg-conversation-card__participant-occupations",
      ]

      // Estrategia 1: Buscar en el elemento proporcionado
      for (const selector of titleSelectors) {
        const titleElement = conversationElement.querySelector(selector)
        if (titleElement && titleElement.offsetHeight > 0 && titleElement.textContent.trim().length > 3) {
          contactTitle = titleElement.textContent.trim()
          console.log("Título encontrado:", contactTitle)
          break
        }
      }

      // Estrategia 2: Buscar en todo el documento
      if (!contactTitle) {
        // MEJORA: Buscar específicamente en el panel de conversación activa
        const activeConversationPanel =
          document.querySelector(".msg-overlay-conversation-bubble--is-active") ||
          document.querySelector(".active-conversation-pane") ||
          document.querySelector(".messaging-thread--active")

        if (activeConversationPanel) {
          for (const selector of titleSelectors) {
            const titleElement = activeConversationPanel.querySelector(selector)
            if (titleElement && titleElement.offsetHeight > 0 && titleElement.textContent.trim().length > 3) {
              contactTitle = titleElement.textContent.trim()
              console.log("Título encontrado en panel activo:", contactTitle)
              break
            }
          }
        }

        // Si aún no lo encontramos, buscar en todo el documento
        if (!contactTitle) {
          for (const selector of titleSelectors) {
            const titleElements = document.querySelectorAll(selector)
            for (const elem of titleElements) {
              if (elem.offsetHeight > 0 && elem.textContent.trim().length > 3) {
                contactTitle = elem.textContent.trim()
                console.log("Título encontrado en documento:", contactTitle)
                break
              }
            }
            if (contactTitle) break
          }
        }
      }

      // PASO 2: Extraer mensajes con múltiples estrategias

      // MEJORA: Primero intentar obtener mensajes del panel de conversación activa
      const activeMessageContainer =
        document.querySelector(".msg-s-message-list-container") ||
        document.querySelector(".msg-s-message-list") ||
        document.querySelector(".messaging-thread__messages") ||
        document.querySelector(".conversation-messages")

      let foundMessages = false

      if (activeMessageContainer) {
        console.log("Contenedor de mensajes activo encontrado, extrayendo mensajes...")

        // Lista unificada de selectores para mensajes
        const messageSelectors = [
          ".msg-s-event-listitem",
          ".msg-s-message-group__msg",
          ".message-thread__message",
          ".message-item",
          ".conversation-message",
        ]

        for (const selector of messageSelectors) {
          const msgElements = activeMessageContainer.querySelectorAll(selector)
          if (msgElements.length > 0) {
            msgElements.forEach((msgElement) => {
              if (msgElement.offsetHeight > 0) {
                try {
                  // MEJORA: Determinar si es un mensaje propio de manera más precisa
                  const isMyMessage =
                    msgElement.classList.contains("outgoing") ||
                    msgElement.classList.contains("msg-s-message-group--outgoing") ||
                    msgElement.querySelector(".outgoing") !== null ||
                    msgElement.getAttribute("data-is-sender") === "true" ||
                    (msgElement.style && msgElement.style.alignSelf === "flex-end") ||
                    msgElement.querySelector(".msg-s-message-group__meta") !== null ||
                    // Verificar la posición del mensaje (derecha = propio, izquierda = otro)
                    window.getComputedStyle(msgElement).justifyContent === "flex-end" ||
                    (msgElement.parentElement &&
                      window.getComputedStyle(msgElement.parentElement).justifyContent === "flex-end")

                  // Obtener texto del mensaje - primero intentar con el contenedor específico de texto
                  let textContent = ""
                  const textElement =
                    msgElement.querySelector(".msg-s-event-listitem__body") ||
                    msgElement.querySelector(".message-content") ||
                    msgElement.querySelector(".message-body") ||
                    msgElement.querySelector(".msg-s-message-group__content")

                  if (textElement) {
                    textContent = textElement.textContent.trim()
                  } else {
                    textContent = msgElement.textContent.trim()
                  }

                  if (textContent) {
                    // Evitar duplicados verificando si ya tenemos este mensaje
                    const isDuplicate = messages.some((m) => m.text === textContent)

                    if (!isDuplicate) {
                      // MEJORA: Usar el nombre del contacto extraído para el remitente
                      messages.push({
                        sender: isMyMessage ? "Yo" : contactName,
                        text: textContent,
                        timestamp: new Date().toISOString(),
                        isMe: isMyMessage,
                      })

                      if (!isMyMessage) {
                        lastReceivedMessage = textContent
                      }

                      foundMessages = true
                    }
                  }
                } catch (error) {
                  console.error("Error al procesar mensaje:", error)
                }
              }
            })
          }

          if (foundMessages) break
        }
      }

      // Si no encontramos mensajes en el contenedor activo, buscar en el elemento proporcionado
      if (!foundMessages) {
        console.log("No se encontraron mensajes en el contenedor activo, buscando en el elemento proporcionado...")

        // Lista unificada de selectores para mensajes
        const messageSelectors = [
          ".msg-s-event-listitem",
          ".msg-s-message-group__msg",
          ".message-thread__message",
          ".message-item",
        ]

        for (const selector of messageSelectors) {
          const msgElements = conversationElement.querySelectorAll(selector)
          if (msgElements.length > 0) {
            msgElements.forEach((msgElement) => {
              if (msgElement.offsetHeight > 0) {
                try {
                  // Determinar si es un mensaje propio
                  const isMyMessage =
                    msgElement.classList.contains("outgoing") ||
                    msgElement.classList.contains("msg-s-message-group--outgoing") ||
                    msgElement.querySelector(".outgoing") !== null ||
                    msgElement.getAttribute("data-is-sender") === "true" ||
                    (msgElement.style && msgElement.style.alignSelf === "flex-end") ||
                    msgElement.querySelector(".msg-s-message-group__meta") !== null

                  // Obtener texto del mensaje - primero intentar con el contenedor específico de texto
                  let textContent = ""
                  const textElement =
                    msgElement.querySelector(".msg-s-event-listitem__body") ||
                    msgElement.querySelector(".message-content") ||
                    msgElement.querySelector(".message-body")

                  if (textElement) {
                    textContent = textElement.textContent.trim()
                  } else {
                    textContent = msgElement.textContent.trim()
                  }

                  if (textContent) {
                    // Evitar duplicados verificando si ya tenemos este mensaje
                    const isDuplicate = messages.some((m) => m.text === textContent)

                    if (!isDuplicate) {
                      messages.push({
                        sender: isMyMessage ? "Yo" : contactName,
                        text: textContent,
                        timestamp: new Date().toISOString(),
                        isMe: isMyMessage,
                      })

                      if (!isMyMessage) {
                        lastReceivedMessage = textContent
                      }

                      foundMessages = true
                    }
                  }
                } catch (error) {
                  console.error("Error al procesar mensaje:", error)
                }
              }
            })
          }

          if (foundMessages) break
        }
      }

      // Si aún no encontramos mensajes, buscar en todo el documento
      if (!foundMessages) {
        console.log("No se encontraron mensajes en el elemento, buscando en todo el documento")

        const messageSelectors = [
          ".msg-s-event-listitem",
          ".msg-s-message-group__msg",
          ".message-thread__message",
          ".message-item",
        ]

        for (const selector of messageSelectors) {
          const msgElements = document.querySelectorAll(selector)
          if (msgElements.length > 0) {
            msgElements.forEach((msgElement) => {
              if (msgElement.offsetHeight > 0) {
                try {
                  const isMyMessage =
                    msgElement.classList.contains("outgoing") ||
                    msgElement.classList.contains("msg-s-message-group--outgoing") ||
                    msgElement.querySelector(".outgoing") !== null ||
                    msgElement.getAttribute("data-is-sender") === "true" ||
                    (msgElement.style && msgElement.style.alignSelf === "flex-end")

                  const textContent = msgElement.textContent.trim()

                  if (textContent) {
                    const isDuplicate = messages.some((m) => m.text === textContent)

                    if (!isDuplicate) {
                      messages.push({
                        sender: isMyMessage ? "Yo" : contactName,
                        text: textContent,
                        timestamp: new Date().toISOString(),
                        isMe: isMyMessage,
                      })

                      if (!isMyMessage) {
                        lastReceivedMessage = textContent
                      }

                      foundMessages = true
                    }
                  }
                } catch (error) {
                  console.error("Error al procesar mensaje:", error)
                }
              }
            })
          }

          if (foundMessages) break
        }
      }

      // Estrategia 3: Buscar snippets de mensajes
      if (!foundMessages) {
        const snippets = document.querySelectorAll(
          ".msg-conversation-card__message-snippet, .conversation-item__message-preview, .message-preview",
        )
        for (const snippet of snippets) {
          if (snippet.offsetHeight > 0 && snippet.textContent.trim()) {
            lastReceivedMessage = snippet.textContent.trim()

            messages.push({
              sender: contactName,
              text: lastReceivedMessage,
              timestamp: new Date().toISOString(),
              isMe: false,
            })

            foundMessages = true
            break
          }
        }
      }

      // Estrategia 4: Buscar cualquier párrafo visible en la página como último recurso
      if (!foundMessages && isForcedExtraction) {
        const paragraphs = document.querySelectorAll("p, .text-body-medium")
        for (const p of paragraphs) {
          if (
            p.offsetHeight > 0 &&
            p.textContent.trim().length > 10 &&
            !p.textContent.includes("LinkedIn") &&
            !p.textContent.includes("derechos reservados")
          ) {
            messages.push({
              sender: contactName,
              text: p.textContent.trim(),
              timestamp: new Date().toISOString(),
              isMe: false,
            })

            lastReceivedMessage = p.textContent.trim()
            foundMessages = true
            break
          }
        }
      }

      // PASO 3: Extraer información sobre mi perfil
      const myProfileElements = document.querySelectorAll(
        ".profile-rail-card__actor-headline, .feed-identity-module__headline, .profile-info__headline",
      )
      for (const elem of myProfileElements) {
        if (elem.offsetHeight > 0 && elem.textContent.trim()) {
          myProfileDescription = elem.textContent.trim()
          break
        }
      }
    } catch (error) {
      console.error("Error al extraer datos:", error)
      // Continuar aunque haya errores
    }

    // PASO 4: Asegurarnos de tener alguna información mínima
    if (contactName === "Desconocido") {
      // Extraer nombre de la URL como último recurso
      const urlParts = window.location.href.split("/")
      for (const part of urlParts) {
        if (part && part !== "in" && part !== "sales" && !part.includes("linkedin") && part.length > 3) {
          contactName = part.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          break
        }
      }
    }

    if (messages.length === 0) {
      messages.push({
        sender: "Sistema",
        text: "No se encontraron mensajes, pero se extrajo la información del perfil.",
        timestamp: new Date().toISOString(),
        isMe: false,
      })
      lastReceivedMessage = "No se encontraron mensajes"
    }

    const result = {
      contactName,
      contactTitle,
      messages,
      lastReceivedMessage,
      myProfileDescription: myProfileDescription || "No disponible",
      url: window.location.href,
      forcedExtraction: isForcedExtraction,
      timestamp: new Date().toISOString(),
    }

    console.log("Datos extraídos:", result)
    return result
  }

  // Enviar datos al webhook
  async function sendToWebhook(data) {
    const webhookUrl = "https://hook.us2.make.com/0tdpujb14unoorvrtu7gp3nauqatp3jf"

    try {
      console.log("Enviando datos al webhook:", data)

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`Error en la respuesta del servidor: ${response.status}`)
      }

      const responseClone = response.clone()

      try {
        return await response.json()
      } catch (jsonError) {
        console.warn("No se pudo parsear la respuesta como JSON, intentando como texto:", jsonError)
        const textResponse = await responseClone.text()
        return { reply: textResponse }
      }
    } catch (error) {
      console.error("Error al enviar datos al webhook:", error)
      throw error
    }
  }

  // Mostrar una notificación
  function showNotification(message) {
    const oldNotifications = document.querySelectorAll(".linkedin-assistant-notification")
    oldNotifications.forEach((notification) => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification)
      }
    })

    const notification = document.createElement("div")
    notification.className = "linkedin-assistant-notification"
    notification.textContent = message

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.classList.add("hide")
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification)
        }
      }, 500)
    }, 5000)
  }

  // Función para intentar crear el botón periódicamente
  function attemptButtonCreation() {
    if (!buttonCreated) {
      createSetButton()
      setTimeout(attemptButtonCreation, 1000)
    }
  }

  // Observar cambios en el DOM
  const observer = new MutationObserver(() => {
    if (!document.getElementById("linkedin-assistant-button")) {
      createSetButton()
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  attemptButtonCreation()
})()

