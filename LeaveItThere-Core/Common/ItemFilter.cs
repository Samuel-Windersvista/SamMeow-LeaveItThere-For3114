using Newtonsoft.Json;
using System.Collections.Generic;

namespace LeaveItThere.Common
{
    internal class ItemFilter
    {
        public bool WhitelistEnabled = false;
        public bool BlacklistEnabled = false;
        public List<string> Whitelist = [];
        public List<string> Blacklist = [];

        [JsonIgnore]
        public HashSet<string> WhitelistSet = [];
        [JsonIgnore]
        public HashSet<string> BlacklistSet = [];

        public void BuildLookups()
        {
            WhitelistSet = new HashSet<string>(Whitelist);
            BlacklistSet = new HashSet<string>(Blacklist);
        }
    }
}
