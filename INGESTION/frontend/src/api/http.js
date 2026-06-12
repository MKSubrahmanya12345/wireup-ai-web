import axios from 'axios'

export const http = axios.create({
  baseURL: '',
  timeout: 60000,
})

export function getErrorMessage(err) {
  const msg =
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.message ??
    'Request failed'
  return String(msg)
}

