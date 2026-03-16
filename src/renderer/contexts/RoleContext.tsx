import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Role } from '../lib/types'

interface RoleContextValue {
  role: Role | null
  setRole: (role: Role | null) => void
  isOwner: boolean
  isEmployee: boolean
  logout: () => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null)

  const logout = useCallback(() => setRole(null), [])

  const value: RoleContextValue = {
    role,
    setRole,
    isOwner: role === 'owner',
    isEmployee: role === 'employee',
    logout
  }

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
