import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model


class RondinConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Browsers can't set custom headers on WebSocket — validate JWT from query string
        query = parse_qs(self.scope['query_string'].decode())
        token_str = query.get('token', [None])[0]
        if not token_str:
            await self.close()
            return
        try:
            decoded = AccessToken(token_str)
            User = get_user_model()
            user = await User.objects.aget(id=decoded['user_id'])
            if not user.is_active:
                raise ValueError('inactive')
        except Exception:
            await self.close()
            return

        self.group_name = 'supervisores'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({'type': 'connected', 'message': 'WebSocket activo'}))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except json.JSONDecodeError:
            pass

    async def rondines_event(self, event):
        await self.send(text_data=json.dumps({
            'type': event['event'],
            'data': event['data'],
        }))
