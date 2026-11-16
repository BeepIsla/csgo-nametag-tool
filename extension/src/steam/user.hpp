#pragma once

#include "types.hpp"

class IClientUser
{
public:
	virtual HSteamUser  GetHSteamUser()         = 0;
	virtual void        LogOn(CSteamID steamID) = 0;
	virtual unknown_ret InvalidateCredentials() = 0;
	virtual void        LogOff()                = 0;
	virtual bool        BLoggedOn()             = 0;
	virtual ELogonState GetLogonState()         = 0;
	virtual bool        BConnected()            = 0;
	virtual unknown_ret BInitiateReconnect()    = 0;
	virtual unknown_ret EConnect()              = 0;
	virtual bool        BTryingToLogin()        = 0;
	STEAMWORKS_STRUCT_RETURN_0(CSteamID, GetSteamID) /*virtual CSteamID GetSteamID() = 0;*/
};
