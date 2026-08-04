import { handleCommentsRequest } from '../server/comments.js'

export default async function handler(request, response) {
  await handleCommentsRequest(request, response)
}
