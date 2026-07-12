FROM postgres:16-alpine

RUN apk add --no-cache dcron

COPY scripts/ /scripts/
COPY crontab /etc/crontabs/root

RUN chmod +x /scripts/*.sh

EXPOSE 8080

CMD ["sh", "-c", "crond && python /scripts/backup_server.py"]
