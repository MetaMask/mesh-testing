FROM node:8
MAINTAINER kumavis

# setup app dir
RUN mkdir -p /www/
WORKDIR /www/

# install dependencies
COPY ./package.json /www/package.json
RUN npm install

# copy over app dir
COPY ./ /www/

# start server
# CMD npm run server
CMD npm run server:telemetry

# expose server
EXPOSE 9000
