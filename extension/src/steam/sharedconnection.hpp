#pragma once

#include "types.hpp"
#include "utlbuffer.hpp"
#include <cstdint>

class IClientSharedConnection
{
public:
	virtual HSharedConnection AllocateSharedConnection()                                                         = 0;
	virtual void              ReleaseSharedConnection(HSharedConnection hConn)                                   = 0;
	virtual int32_t           SendMessage(HSharedConnection hConn, void *pBuf, size_t szBuf)                     = 0;
	virtual int32_t           SendMessageAndAwaitResponse(HSharedConnection hConn, void *pBuf, size_t szBuf)     = 0;
	virtual void              RegisterEMsgHandler(HSharedConnection hConn, uint32_t eMsg)                        = 0;
	virtual void              RegisterServiceMethodHandler(HSharedConnection hConn, const char *msgHandler)      = 0;
	virtual bool              BPopReceivedMessage(HSharedConnection hConn, CUtlBuffer *pBufOut, uint32_t *hCall) = 0;
	virtual unknown_ret       InitiateConnection()                                                               = 0;
};
