FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

#Serve application
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Serves the SPA and forwards /api/ requests to the CPS Calculator (backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]