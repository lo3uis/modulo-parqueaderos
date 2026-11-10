import { streamText } from 'ai'
import { SYSTEM_PROMPT } from '@/shared/lib/anthropic'
import { createClient } from '@/shared/lib/supabase/server'
import { getModelInstance, validateModelId } from '@/shared/lib/models'
import { getModelById } from '@/config/models'

type IncomingMessage = {
  role: 'user' | 'assistant' | 'system'
  content?: string
  parts?: Array<{ type: string; text?: string }>
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      conversationId,
      modelId: rawModelId,
    } = await req.json()

    const modelId = validateModelId(rawModelId)
    const modelInfo = getModelById(modelId)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (conversationId && user) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single()

      if (conversation && conversation.user_id && conversation.user_id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const openRouterKey = ((): string => {
      const env = process.env as Record<string, string | undefined>
      for (const [key, val] of Object.entries(env)) {
        const k = key.trim().toLowerCase()
        if (k === 'openrouter_api_key' || k === 'next_public_openrouter_api_key') {
          const cleanVal = (val || '').trim().replace(/^['"]|['"]$/g, '')
          if (cleanVal.length > 5) return cleanVal
        }
      }
      return ''
    })()

    if (!openRouterKey && (modelInfo?.provider === 'openrouter' || !modelInfo)) {
      return new Response(
        'Falta configurar la variable OPENROUTER_API_KEY en el panel de Vercel (Settings -> Environment Variables).',
        { status: 500 }
      )
    }

    const model = getModelInstance(modelId)

    const thinkingConfig = modelInfo?.supportsThinking
      ? {
          thinking: {
            type: 'enabled' as const,
            budget_tokens: 1000,
          },
        }
      : {}

    const modelMessages = (messages as IncomingMessage[]).map((message) => ({
      role: message.role,
      content:
        message.content ??
        message.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text ?? '')
          .join('') ??
        '',
    }))

    const lastMessage = modelMessages.at(-1)

    if (lastMessage?.role === 'user' && conversationId) {
      const { error: userMessageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user?.id || null,
          role: 'user',
          content: lastMessage.content,
          model_used: modelId,
        })

      if (userMessageError) {
        console.error(
          'Error saving user message:',
          userMessageError,
        )

        return Response.json(
          { error: 'Failed to save user message' },
          { status: 500 },
        )
      }
    }

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      maxOutputTokens: 2000,
      ...thinkingConfig,
      onFinish: async ({ text, usage }) => {
        if (!conversationId) return

        try {
          const { error: assistantMessageError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              user_id: user?.id || null,
              role: 'assistant',
              content: text,
              model_used: modelId,
              tokens_input: usage.inputTokens,
              tokens_output: usage.outputTokens,
            })

          if (assistantMessageError) {
            console.error(
              'Error saving assistant message:',
              assistantMessageError,
            )

            return
          }

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)

          if (count === 2) {
            const firstUserMessage = modelMessages.find(
              (message) => message.role === 'user',
            )

            const titleResult = await streamText({
              model,
              maxOutputTokens: 100,
              system:
                'Generate a short title (max 5 words) for this conversation based on the first user message. Respond ONLY with the title, no quotes or punctuation.',
              messages: [
                {
                  role: 'user',
                  content: firstUserMessage?.content ?? '',
                },
              ],
            })

            const title = await titleResult.text

            await supabase
              .from('conversations')
              .update({ title: title.trim() })
              .eq('id', conversationId)
          }
        } catch (error) {
          console.error('Error saving messages:', error)
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Chat endpoint error:', error)

    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}