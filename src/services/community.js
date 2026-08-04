import axios from 'axios'

const DEVICE_KEY = 'oneul-weather-community-device'

const getAuthorToken = () => {
  let token = localStorage.getItem(DEVICE_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, token)
  }
  return token
}

export const getCommunityComments = async (regionId) => {
  const response = await axios.get('/api/comments', { params: { regionId, limit: 30 } })
  return response.data.comments
}

export const createCommunityComment = async (payload) => {
  const response = await axios.post('/api/comments', {
    ...payload,
    authorToken: getAuthorToken(),
  })
  return response.data.comment
}

export const updateCommunityComment = async (payload) => {
  const response = await axios.put('/api/comments', payload)
  return response.data.comment
}

export const deleteCommunityComment = async (payload) => {
  const response = await axios.delete('/api/comments', { data: payload })
  return response.data.id
}
