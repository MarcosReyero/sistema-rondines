import api from './api'

export const login = async (username, password) => {
  const { data } = await api.post('/auth/login/', { username, password })
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  localStorage.setItem('user', JSON.stringify(data.user))
  return data.user
}

export const logout = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

export const isAuthenticated = () => !!localStorage.getItem('access_token')

export const isSupervisor = () => {
  const user = getUser()
  return user?.rol === 'supervisor'
}
