'use client'

import { useEffect, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { DEFAULT_MODEL_ID } from '@/config/models'
import type { UIMessage as AIMessage } from '@ai-sdk/react'

interface ChatInterfaceProps {
  conversationId: string
  initialMessages?: AIMessage[]
}

export function ChatInterface({
  conversationId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID)
  const [input, setInput] = useState('')

  useEffect(() => {
    const savedModelId = localStorage.getItem('selectedModelId')

    if (savedModelId) {
      setSelectedModelId(savedModelId)
    }
  }, [])

  const { messages, sendMessage, setMessages, status, error } = useChat()

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    try {
      await sendMessage(
        { text: userMessage },
        {
          body: {
            conversationId,
            modelId: selectedModelId,
          },
        },
      )
    } catch (error) {
      console.error('Error submitting message:', error)
      setInput(userMessage)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value)
  }

  return (
    <div className="flex h-full flex-col">
      {error && (
        <div className="m-6 mb-0 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">
            ⚠️ Error: {error.message}
          </p>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput
        input={input}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
    </div>
  )
}