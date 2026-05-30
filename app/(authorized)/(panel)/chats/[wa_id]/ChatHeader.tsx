'use client'

import { useEffect } from 'react'
import MoreIcon from '@/components/icons/MoreIcon'
import BlankUser from '../BlankUser'
import { UPDATE_CURRENT_CONTACT, useContacts, useCurrentContactDispatch } from '../CurrentContactContext'
import { markChatAsRead } from './markAsRead'

export default function ChatHeader({ waId }: { waId: string }) {
    const currentContact = useContacts()
    const dispatch = useCurrentContactDispatch()
    useEffect(() => {
        if (!currentContact?.current && dispatch) {
            dispatch({type: UPDATE_CURRENT_CONTACT, waId: Number.parseInt(waId)})
        }
    })
    // Clear the unread badge whenever a chat is opened.
    useEffect(() => {
        markChatAsRead(Number.parseInt(waId)).catch(console.error)
    }, [waId])
    return (
        <div className="bg-panel-header-background border-b">
            <header className="h-16 px-4 flex flex-row gap-3 items-center">
                <BlankUser className="w-10 h-10 shrink-0" />
                <div className='flex-grow min-w-0'>
                    <div className="text-primary-strong font-medium truncate">{currentContact?.current?.profile_name || waId}</div>
                    <div className="text-xs text-gray-500 truncate">{waId}</div>
                </div>
                <MoreIcon className='text-panel-header-icon' />
            </header>
        </div>
    )
}
