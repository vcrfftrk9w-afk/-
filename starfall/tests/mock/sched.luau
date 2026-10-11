-- Virtual time, the task library and signals for offline tests.

local Sched = {}

Sched.now = 0
Sched.epoch = 1791600000 -- «реальное» время сервера в начале теста (os.time)
Sched.errors = {} :: { string }
Sched.frame = 1 / 20

type Entry = { time: number, seq: number, thread: thread, args: { n: number, [number]: any }? }

local queue: { Entry } = {}
local seq = 0
local cancelled: { [thread]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local frameSignals = {}

local function report(thread: thread, err: any)
	local message = debug.traceback(thread, tostring(err))
	table.insert(Sched.errors, message)
	print("\n!!! ERROR: " .. message .. "\n")
end

local function resume(thread: thread, ...)
	if cancelled[thread] then
		return
	end
	if coroutine.status(thread) ~= "suspended" then
		return
	end
	local ok, err = coroutine.resume(thread, ...)
	if not ok then
		report(thread, err)
	end
end
Sched.resume = resume

local function push(time: number, thread: thread, args)
	seq += 1
	table.insert(queue, { time = time, seq = seq, thread = thread, args = args })
end

function Sched.spawn(fn: any, ...)
	local thread = type(fn) == "thread" and fn or coroutine.create(fn)
	resume(thread, ...)
	return thread
end

function Sched.defer(fn: any, ...)
	local thread = type(fn) == "thread" and fn or coroutine.create(fn)
	push(Sched.now, thread, table.pack(...))
	return thread
end

function Sched.delay(time: number?, fn: any, ...)
	local thread = type(fn) == "thread" and fn or coroutine.create(fn)
	push(Sched.now + (time or 0), thread, table.pack(...))
	return thread
end

function Sched.wait(time: number?): number
	if not coroutine.isyieldable() then
		error("task.wait called from a thread that cannot yield", 2)
	end
	local thread = coroutine.running()
	local start = Sched.now
	push(Sched.now + math.max(time or 0, Sched.frame), thread, nil)
	coroutine.yield()
	return Sched.now - start
end

function Sched.cancel(thread: thread)
	cancelled[thread] = true
end

function Sched.onFrame(fn: (number) -> ())
	table.insert(frameSignals, fn)
end

-- Прокручивает виртуальное время вперёд, выполняя все задачи по порядку
function Sched.advance(duration: number)
	local target = Sched.now + duration
	local nextFrame = Sched.now + Sched.frame
	while true do
		local bestIndex = nil
		local best: Entry? = nil
		for index, entry in ipairs(queue) do
			if entry.time <= target and (best == nil or entry.time < best.time or (entry.time == best.time and entry.seq < best.seq)) then
				best = entry
				bestIndex = index
			end
		end
		if nextFrame <= target and (best == nil or nextFrame < best.time) then
			Sched.now = nextFrame
			nextFrame += Sched.frame
			for _, fn in ipairs(frameSignals) do
				fn(Sched.frame)
			end
		elseif best and bestIndex then
			table.remove(queue, bestIndex)
			Sched.now = math.max(Sched.now, best.time)
			local args = best.args
			if args then
				resume(best.thread, table.unpack(args, 1, args.n))
			else
				resume(best.thread)
			end
		else
			break
		end
	end
	Sched.now = target
end

function Sched.pending(): number
	return #queue
end

---------------------------------------------------------------------
-- Сигналы (RBXScriptSignal)
---------------------------------------------------------------------

local Signal = {}
local SignalMT = { __type = "RBXScriptSignal" }
SignalMT.__index = Signal
local ConnectionMT = { __type = "RBXScriptConnection" }
ConnectionMT.__index = ConnectionMT

function ConnectionMT:Disconnect()
	self.Connected = false
end

function Signal.new(name: string?)
	return setmetatable({ _name = name or "Signal", _handlers = {}, _waiting = {}, _dead = false }, SignalMT)
end

function Signal:Connect(fn)
	if type(fn) ~= "function" then
		error("Attempt to connect failed: Passed value is not a function", 2)
	end
	local connection = setmetatable({ Connected = not self._dead, _fn = fn, _once = false }, ConnectionMT)
	table.insert(self._handlers, connection)
	return connection
end

function Signal:Once(fn)
	local connection = self:Connect(fn)
	connection._once = true
	return connection
end

function Signal:Wait()
	if not coroutine.isyieldable() then
		error("Signal:Wait called from a thread that cannot yield", 2)
	end
	table.insert(self._waiting, coroutine.running())
	return coroutine.yield()
end

function Signal:Fire(...)
	if self._dead then
		return
	end
	local handlers = self._handlers
	local alive = {}
	for _, connection in ipairs(handlers) do
		if connection.Connected then
			table.insert(alive, connection)
		end
	end
	self._handlers = alive
	for _, connection in ipairs(alive) do
		if connection.Connected then
			if connection._once then
				connection.Connected = false
			end
			Sched.spawn(connection._fn, ...)
		end
	end
	local waiting = self._waiting
	self._waiting = {}
	for _, thread in ipairs(waiting) do
		resume(thread, ...)
	end
end

function Signal:Destroy()
	self._dead = true
	for _, connection in ipairs(self._handlers) do
		connection.Connected = false
	end
	self._handlers = {}
end

function Signal:Count(): number
	local count = 0
	for _, connection in ipairs(self._handlers) do
		if connection.Connected then
			count += 1
		end
	end
	return count
end

Sched.Signal = Signal

Sched.task = {
	spawn = Sched.spawn,
	defer = Sched.defer,
	delay = Sched.delay,
	wait = Sched.wait,
	cancel = Sched.cancel,
	synchronize = function() end,
	desynchronize = function() end,
}

Sched.os = {
	clock = function()
		return Sched.now
	end,
	time = function(t: any?)
		if t ~= nil then
			return os.time(t)
		end
		return Sched.epoch + math.floor(Sched.now)
	end,
	date = os.date,
	difftime = os.difftime,
}

return Sched
