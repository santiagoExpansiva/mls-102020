/// <mls fileReference="_102020_/l2/skills/aura/language.ts" enhancement="_blank"/>

export const skill = ` 

Para definir o bloco i18n no sistema collab codes, deve seguir o padrão:

\`\`\`typescript

/// **collab_i18n_start**

const message_en: Record<string, string> = {
    text1: 'value1'
}

type MessageType = typeof message_en;
const messages: { [key: string]: MessageType } = { en: message_en };

/// **collab_i18n_end**

\`\`\`

Para cada nova linguagem deve ser adicionado um novo objeto com keys values das languages.

`