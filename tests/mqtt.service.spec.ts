import { MqttService } from '../src/mqtt.service';
import { inject, TestBed } from '@angular/core/testing';
import { MqttServiceConfig, MqttClientService } from '../src/mqtt.module';
import {
  IMqttMessage,
  IMqttServiceOptions,
  IOnConnectEvent,
  IOnErrorEvent,
  IOnMessageEvent,
  IOnSubackEvent,
  MqttConnectionState
} from '../src/mqtt.model';
import { skip } from 'rxjs/operators';
import { noop } from 'rxjs';

const config: IMqttServiceOptions = {
  connectOnCreate: true,
  hostname: 'test.mosquitto.org',
  port: 8080,
  path: ''
};

const uuid = generateUuid();

describe('MqttService', () => {
  let mqttService: MqttService;
  let originalTimeout;

  beforeEach(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: MqttServiceConfig,
          useValue: config
        },
        {
          provide: MqttClientService,
          useValue: undefined
        }
      ]
    });
    mqttService = TestBed.get(MqttService);
  });

  afterEach(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  it('#constructor', () => {
    expect(mqttService).toBeDefined();
  });


  it('#connect', (done) => {
    mqttService.disconnect(true);
    mqttService.connect({ ...config, clientId: 'connect' + uuid });
    mqttService.state.pipe(skip(2)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CONNECTED);
      expect(mqttService.clientId).toBe('connect' + uuid);
      done();
    });
  });

  it('#clientId', () => {
    expect(mqttService.clientId.startsWith('client-')).toBeTruthy();
  });

  it('#disconnect', (done) => {
    mqttService.disconnect(true);
    mqttService.state.pipe(skip(1)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CLOSED);
      done();
    });
  });

  it('#observe', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe((_: IMqttMessage) => {
      done();
    });
  });

  it('#publish', (done) => {
    mqttService.observe('ngx-mqtt/tests/publish/' + uuid).subscribe((_: IMqttMessage) => {
      done();
    });
    mqttService.publish('ngx-mqtt/tests/publish/' + uuid, 'publish').subscribe(noop);
  });

  it('#unsafePublish', (done) => {
    mqttService.observe('ngx-mqtt/tests/unsafePublish/' + uuid).subscribe((_: IMqttMessage) => {
      done();
    });
    mqttService.unsafePublish('ngx-mqtt/tests/unsafePublish/' + uuid, 'unsafePublish');
  });


  it('#onClose', (done) => {
    mqttService.disconnect(true);
    mqttService.onClose.subscribe(() => {
      done();
    });
  });

  it('#onConnect', (done) => {
    mqttService.onConnect.subscribe((e: IOnConnectEvent) => {
      expect(e.cmd).toBe('connack');
      done();
    });
  });

  // it('#onReconnect', (done) => {

  // });

  it('#onMessage', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe(noop);
    mqttService.onMessage.subscribe((e: IOnMessageEvent) => {
      expect(e.cmd).toBe('publish');
      done();
    });
  });

  it('#onSuback', (done) => {
    mqttService.observe('$SYS/broker/uptime').subscribe(noop);
    mqttService.onSuback.subscribe((e: IOnSubackEvent) => {
      expect(e.filter).toBe('$SYS/broker/uptime');
      expect(e.granted).toBeTruthy();
      done();
    });
  });

  it('#onError', (done) => {
    mqttService.disconnect(true);
    mqttService.connect({ hostname: 'not_existing' });
    mqttService.state.pipe(skip(2)).subscribe(state => {
      expect(state).toBe(MqttConnectionState.CLOSED);
      mqttService.unsafePublish('onError', 'shouldThrow');
    });
    mqttService.onError.subscribe((e: IOnErrorEvent) => {
      expect(e.type).toBe('error');
      done();
    });
  });
});

describe('MqttService.filterMatchesTopic', () => {
  it('is defined', () => {
    expect(MqttService.filterMatchesTopic).toBeDefined();
  });
  const matches: any = [
    ['$', '#', false],
    ['a', 'a', true],
    ['a', '#', true],
    ['a', 'a/#', true],
    ['a/b', 'a/#', true],
    ['a/b/c', 'a/#', true],
    ['b/c/d', 'a/#', false],
    ['a', 'a/+', false],
    ['a', '/a', false],
    ['a/b', 'a/b', true],
    ['a/b/c', 'a/+/c', true],
    ['a/b/c', 'a/+/d', false],
    ['#', '$SYS/#', false],
    ['a/b', 'a/+', true],
    ['a/b', 'a/#', true],
    ['a/b', 'a/b/#', true],
    ['a/b/c', 'a/b/c', true],
  ];
  for (let i = 0; i < matches.length; i++) {
    it(`${matches[i][0]} matches ${matches[i][1]}: ${matches[i][2]}`, () => {
      expect(MqttService.filterMatchesTopic(matches[i][1], matches[i][0])).toBe(matches[i][2]);
    });
  }
});

function generateUuid() {
  let uuid = '', i, random;
  for (i = 0; i < 32; i++) {
    random = Math.random() * 16 | 0;

    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-'
    }
    uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
  }
  return uuid;
}