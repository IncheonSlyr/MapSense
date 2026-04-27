import { forward } from './_proxy.js'

export default {
  fetch(request) {
    return forward(request, '/api/history')
  },
}
